import { LabMap, LabLevel, CompoundColor, LabRes } from '@/constant/ResourceConstant'

export default class AutoLab extends Room {
    autoLab() {
        if (Game.time % 50) return;
        if (!this.lab || !this.lab.length) return;
        const botmem = Memory['StructControlData'][this.name];

        // 关停时不处理
        if (!botmem || !botmem.lab) return;
        const labProduct = botmem.labAtype && botmem.labBtype ?
            REACTIONS[botmem.labAtype][botmem.labBtype] : null;
        const amount = botmem.labAmount;    // 产物限额

        const labA = Game.getObjectById(botmem.labA) as StructureLab;
        const labB = Game.getObjectById(botmem.labB) as StructureLab;
        if (!labA || !labB || (botmem.labNum && this.lab.length > botmem.labNum + 3)) setLab(this);
        // 检查库存是否够合成
        const ResAmountCheck = (this.getResAmount(botmem.labAtype) >= 1000 &&
            this.getResAmount(botmem.labBtype) >= 1000)
        // 检查当前填充的是否够合成
        const LabMineralCheck = labA && labB &&
            labA.mineralType === botmem.labAtype &&
            labB.mineralType === botmem.labBtype &&
            labA.store[botmem.labAtype] >= 15 &&
            labB.store[botmem.labBtype] >= 15;
        // 未超限额，原料充足，则不变更任务
        if (botmem.labAtype && botmem.labBtype && labProduct &&
            (amount <= 0 || this.getResAmount(labProduct) < amount) &&
            (ResAmountCheck || LabMineralCheck)
        ) return;

        // 关闭任务 如果当前任务存在且已达限额
        if (labProduct && amount > 0 && this.getResAmount(labProduct) >= amount) {
            botmem.labAtype = null;
            botmem.labBtype = null;
            botmem.labAmount = 0;
            global.log(`[自动Lab合成] ${this.name}已自动关闭lab合成任务: ${labProduct}`)
        }

        // 获取新任务
        let [task, taskAmount] = getCustomizeTask(this);
        // if (!task) [task, taskAmount] = getT1Task(this);
        // if (!task) [task, taskAmount] = getT2Task(this);
        // if (!task) [task, taskAmount] = getT3Task(this);
        if (!task || !taskAmount) return;

        botmem.labAtype = LabMap[task]['raw1'];
        botmem.labBtype = LabMap[task]['raw2'];
        botmem.labAmount = taskAmount;

        global.log(`[自动Lab合成] ${this.name}已自动分配lab合成任务: ${botmem.labAtype}/${botmem.labBtype} -> ${REACTIONS[botmem.labAtype][botmem.labBtype]}, 限额: ${taskAmount || '无'}`)
        return OK;
    }
}

// const getCustomizeTask = (room: Room) => {
//     const autoLabMap = Memory['AutoData']['AutoLabData'][room.name];
//     if (!autoLabMap || !Object.keys(autoLabMap).length) return [null, 0];

//     // 查找未到达限额且原料足够的任务, 按优先级选择
//     let task = null;
//     let lv = Infinity; // 优先级
//     for (const res in autoLabMap) {
//         const level = LabLevel[res];
//         if (lv <= level) continue;

//         if (autoLabMap[res] > 0 && room.getResAmount(res) >= autoLabMap[res] * 0.9) continue;
//         // 检查原料是否足够 如果原料不够并且原料可以合成则给出合成原料任务
//         if (room.getResAmount(LabMap[res]['raw1']) < 6000 ||
//             room.getResAmount(LabMap[res]['raw2']) < 6000) continue;
//         task = res;
//         lv = level;
//     }

//     let taskAmount = task ? autoLabMap[task] : 0;

//     return [task, taskAmount]
// }

export const getCustomizeTask = (room: Room): [string | null, number] => {
    const autoLabMap = Memory['AutoData']?.['AutoLabData']?.[room.name];
    if (!autoLabMap || !Object.keys(autoLabMap).length) return [null, 0];

    // 递归检查化合物合成可行性并返回最需要优先合成的任务
    const checkCompoundFeasibility = (compound: string, targetAmount: number): [string | null, number] => {
        const currentAmount = room.getResAmount(compound);
        
        // 如果已经达到目标数量的90%，不需要合成
        if (currentAmount >= targetAmount * 0.99) {
            return [null, 0];
        }
        
        // 如果不是可合成的化合物（在LabMap中），返回null
        if (!LabMap[compound]) {
            return [null, 0];
        }
        
        const recipe = LabMap[compound];
        const raw1 = recipe.raw1;
        const raw2 = recipe.raw2;
        
        // 计算需要合成的数量，单次最多合成6000
        const needToProduce = Math.min(targetAmount - currentAmount, 6000);
        
        if (needToProduce <= 0) {
            return [null, 0];
        }
        
        // 检查原料1是否足够
        const raw1Current = room.getResAmount(raw1);
        const raw1Needed = needToProduce;
        
        // 如果原料1是基础资源且不足6000，跳过此任务
        if (LabRes.includes(raw1) && raw1Current < Math.min(6000, raw1Needed)) {
            return [null, 0];
        }
        
        if (raw1Current < raw1Needed) {
            if (LabMap[raw1]) {
                // 递归检查原料1的合成可行性
                const raw1Target = Math.max(raw1Needed - raw1Current, 0);
                const [subTask, subAmount] = checkCompoundFeasibility(raw1, raw1Target);
                if (subTask) {
                    return [subTask, Math.min(subAmount, 6000)];
                } else {
                    return [null, 0];
                }
            } else {
                // 既不是基础资源也不可合成
                return [null, 0];
            }
        }
        
        // 检查原料2是否足够
        const raw2Current = room.getResAmount(raw2);
        const raw2Needed = needToProduce;
        
        // 如果原料2是基础资源且不足6000，跳过此任务
        if (LabRes.includes(raw2) && raw2Current < Math.min(6000, raw2Needed)) {
            return [null, 0];
        }
        
        if (raw2Current < raw2Needed) {
            if (LabMap[raw2]) {
                // 递归检查原料2的合成可行性
                const raw2Target = Math.max(raw2Needed - raw2Current, 0);
                const [subTask, subAmount] = checkCompoundFeasibility(raw2, raw2Target);
                if (subTask) {
                    return [subTask, Math.min(subAmount, 6000)];
                } else {
                    return [null, 0];
                }
            } else {
                // 既不是基础资源也不可合成
                return [null, 0];
            }
        }
        
        // 两种原料都足够，返回当前化合物
        return [compound, needToProduce];
    };

    // 获取所有需要合成的化合物并按优先级排序
    const targetCompounds = Object.keys(autoLabMap)
        .filter(res => autoLabMap[res] > 0 && room.getResAmount(res) < autoLabMap[res] * 0.9)
        .sort((a, b) => (LabLevel[a] || 999) - (LabLevel[b] || 999));
    
    // 依次检查每个目标化合物
    for (const compound of targetCompounds) {
        const targetAmount = autoLabMap[compound];
        const [task, taskAmount] = checkCompoundFeasibility(compound, targetAmount);
        if (task) {
            return [task, taskAmount];
        }
    }
    
    return [null, 0];
};

// 设置lab任务的函数
export const setLabTask = (room: Room, labA: StructureLab, labB: StructureLab): void => {
    const [task, taskAmount] = getCustomizeTask(room);
    
    if (!task || taskAmount <= 0) {
        console.log(`[自动Lab合成] ${room.name} 没有需要合成的化合物`);
        return;
    }
    
    const color = CompoundColor[task] || '#ffffff';
    const targetAmount = Memory['AutoData']['AutoLabData'][room.name][task] || 0;
    const currentAmount = room.getResAmount(task);
    
    console.log(`[自动Lab合成] ${room.name} 设置合成任务: ${getColoredText(task, color)} (${currentAmount}/${targetAmount})，数量: ${taskAmount}`);
    
    const recipe = LabMap[task];
    if (!recipe) {
        console.log(`[错误] ${task} 没有配方定义`);
        return;
    }
    
    const raw1 = recipe.raw1;
    const raw2 = recipe.raw2;
    const raw1Color = CompoundColor[raw1] || '#ffffff';
    const raw2Color = CompoundColor[raw2] || '#ffffff';
    
    // 检查原料是否足够
    if (room.getResAmount(raw1) >= taskAmount && room.getResAmount(raw2) >= taskAmount) {
        console.log(`[自动Lab合成] ${room.name} 设置labA: ${labA.id}, labB: ${labB.id} 合成 ${getColoredText(task, color)} (${taskAmount})`);
        console.log(`原料: ${getColoredText(raw1, raw1Color)}(${room.getResAmount(raw1)}), ${getColoredText(raw2, raw2Color)}(${room.getResAmount(raw2)})`);
        // 这里可以添加实际的lab设置代码
        // labA.runLab(labB, task);
    } else {
        console.log(`[自动Lab合成] ${room.name} 原料不足: ${getColoredText(raw1, raw1Color)}(${room.getResAmount(raw1)}/${taskAmount}) / ${getColoredText(raw2, raw2Color)}(${room.getResAmount(raw2)}/${taskAmount})`);
    }
};

// 显示房间所有合成目标的函数
export const showRoomLabTasks = (room: Room): void => {
    const autoLabMap = Memory['AutoData']?.['AutoLabData']?.[room.name];
    if (!autoLabMap) {
        console.log(`${room.name} 没有配置自动合成任务`);
        return;
    }
    
    console.log(`${room.name} 自动合成目标:`);
    console.log('化合物 | 当前数量 | 目标数量 | 进度');
    console.log('-----------------------------------');
    
    const sortedCompounds = Object.keys(autoLabMap)
        .filter(res => autoLabMap[res] > 0)
        .sort((a, b) => (LabLevel[a] || 999) - (LabLevel[b] || 999));
    
    for (const compound of sortedCompounds) {
        const target = autoLabMap[compound];
        const current = room.getResAmount(compound);
        const progress = target > 0 ? Math.min((current / target) * 100, 100).toFixed(1) : '0.0';
        const color = CompoundColor[compound] || '#ffffff';
        
        const barLength = 20;
        const filled = Math.floor((current / target) * barLength);
        const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
        
        console.log(`${getColoredText(compound, color).padEnd(10)} ${current.toString().padStart(8)} / ${target.toString().padStart(8)} ${progress.padStart(6)}% ${bar}`);
    }
    
    const [task, taskAmount] = getCustomizeTask(room);
    if (task) {
        console.log(`\n建议的合成任务: ${getColoredText(task, CompoundColor[task] || '#ffffff')} (${taskAmount})`);
    }
};

// 获取化合物的完整合成路径和所需数量
export const getSynthesisPathWithAmount = (room: Room, targetCompound: string): any[] => {
    const autoLabMap = Memory['AutoData']?.['AutoLabData']?.[room.name];
    if (!autoLabMap || !autoLabMap[targetCompound]) {
        return [];
    }
    
    const targetAmount = autoLabMap[targetCompound];
    const currentAmount = room.getResAmount(targetCompound);
    const neededAmount = Math.max(0, targetAmount - currentAmount);
    
    if (neededAmount <= 0) {
        return [];
    }
    
    const path: any[] = [];
    
    const calculatePath = (compound: string, amount: number, depth: number = 0): any => {
        const current = room.getResAmount(compound);
        const node = {
            compound,
            current,
            needed: amount,
            color: CompoundColor[compound] || '#ffffff',
            depth,
            children: []
        };
        
        if (LabMap[compound] && amount > 0) {
            const recipe = LabMap[compound];
            const raw1 = recipe.raw1;
            const raw2 = recipe.raw2;
            const rawNeeded = amount;
            
            // 检查原料1
            if (LabMap[raw1] || LabRes.includes(raw1)) {
                const raw1Current = room.getResAmount(raw1);
                const raw1Needed = Math.max(0, rawNeeded - raw1Current);
                if (raw1Needed > 0) {
                    node.children.push(calculatePath(raw1, raw1Needed, depth + 1));
                }
            }
            
            // 检查原料2
            if (LabMap[raw2] || LabRes.includes(raw2)) {
                const raw2Current = room.getResAmount(raw2);
                const raw2Needed = Math.max(0, rawNeeded - raw2Current);
                if (raw2Needed > 0) {
                    node.children.push(calculatePath(raw2, raw2Needed, depth + 1));
                }
            }
        }
        
        return node;
    };
    
    path.push(calculatePath(targetCompound, neededAmount));
    return path;
};

// 显示合成路径树
export const showSynthesisPathTree = (room: Room, targetCompound: string): void => {
    const pathTree = getSynthesisPathWithAmount(room, targetCompound);
    
    if (pathTree.length === 0) {
        console.log(`${room.name} 没有需要合成的 ${targetCompound}`);
        return;
    }
    
    const printNode = (node: any, prefix: string = ''): void => {
        const color = node.color;
        const compoundText = getColoredText(node.compound, color);
        const info = `(当前: ${node.current}, 需要: ${node.needed})`;
        
        console.log(`${prefix}${compoundText} ${info}`);
        
        // 修复：使用常规for循环来避免类型错误
        for (let i = 0; i < node.children.length; i++) {
            const child = node.children[i];
            const isLast = i === node.children.length - 1;
            const childPrefix = prefix + (isLast ? '└── ' : '├── ');
            printNode(child, childPrefix);
        }
    };
    
    console.log(`${room.name} 合成 ${getColoredText(targetCompound, CompoundColor[targetCompound] || '#ffffff')} 的路径树:`);
    
    // 修复：使用for循环遍历根节点
    for (let i = 0; i < pathTree.length; i++) {
        printNode(pathTree[i]);
    }
};

// 辅助函数：生成带颜色的文本
const getColoredText = (text: string, color: string): string => {
    // 这里使用HTML格式的颜色标记，适用于Web控制台
    return `<span style="color: ${color}; font-weight: bold;">${text}</span>`;
};
// const getT1Task = (room: Room) => {
//     if (Game.time % 100) return [null, 0];

//     const r = (res: string) => room.getResAmount(res);

//     let threshold = 20e3;
//     const H = r(RESOURCE_HYDROGEN);
//     const O = r(RESOURCE_OXYGEN);

//     if (((H >= threshold && O >= 5000) || (O >= threshold && H >= 5000)) && r('OH') < 60000) {
//         return ['OH', r('OH') + 10e3];
//     }
//     if (r('U') >= threshold && H >= 5000) {
//         return ['UH', r('UH') + 10e3];
//     }
//     if (r('K') >= threshold && O >= 5000) {
//         return ['KO', r('KO') + 10e3];
//     }

//     if (r('L') >= threshold) {
//         const LO = r('LO'), LH = r('LH');
//         if (O >= 5000 && LO <= LH) return ['LO', LO + 10e3];
//         if (H >= 5000 && LH <= LO) return ['LH', LH + 10e3];
//     }
//     if (r('Z') >= threshold) {
//         const ZO = r('ZO'), ZH = r('ZH');
//         if (O >= 5000 && ZO <= ZH) return ['ZO', ZO + 10e3];
//         if (H >= 5000 && ZH <= ZO) return ['ZH', ZH + 10e3];
//     }

//     if (r('ZK') >= 5000 && r('UL') >= 5000) {
//         return ['G', r('G') + 10e3];
//     }

//     return [null, 0];
// }

// const getT2Task = (room: Room) => {
//     if (Game.time % 100) return [null, 0];

//     const r = (res: string) => room.getResAmount(res);
//     if (r('OH') < 9000) return [null, 0];
//     const check = (res1: string, res2: string) => r(res1) > Math.max(r(res2), 20e3);
//     if (check('GH', 'GH2O')) return ['GH2O', r('GH2O') + 10e3];
//     if (check('GO', 'GHO2')) return ['GHO2', r('GHO2') + 10e3];
//     if (check('LH', 'LH2O')) return ['LH2O', r('LH2O') + 10e3];
//     if (check('LO', 'LHO2')) return ['LHO2', r('LHO2') + 10e3];
//     if (check('ZH', 'ZH2O')) return ['ZH2O', r('ZH2O') + 10e3];
//     if (check('ZO', 'ZHO2')) return ['ZHO2', r('ZHO2') + 10e3];
//     if (check('UH', 'UH2O')) return ['UH2O', r('UH2O') + 10e3];
//     if (check('KO', 'KHO2')) return ['KHO2', r('KHO2') + 10e3];
//     return [null, 0];
// }

// const getT3Task = (room: Room) => {
//     if (Game.time % 100) return [null, 0];

//     const r = (res: string) => room.getResAmount(res);
//     if (r('X') < 9000) return [null, 0];
//     const check = (res1: string, res2: string) => r(res1) > Math.max(r(res2), 20e3);
//     if (check('GH2O', 'XGH2O')) return ['XGH2O', r('XGH2O') + 10e3];
//     if (check('GHO2', 'XGHO2')) return ['XGHO2', r('XGHO2') + 10e3];
//     if (check('LH2O', 'XLH2O')) return ['XLH2O', r('XLH2O') + 10e3];
//     if (check('LHO2', 'XLHO2')) return ['XLHO2', r('XLHO2') + 10e3];
//     if (check('ZH2O', 'XZH2O')) return ['XZH2O', r('XZH2O') + 10e3];
//     if (check('ZHO2', 'XZHO2')) return ['XZHO2', r('XZHO2') + 10e3];
//     if (check('UH2O', 'XUH2O')) return ['XUH2O', r('XUH2O') + 10e3];
//     if (check('KHO2', 'XKHO2')) return ['XKHO2', r('XKHO2') + 10e3];
//     return [null, 0];
// }

const setLab = (room: Room) => {
    // 设置对应labA和labB 一个房间最多10个lab 如果小于7级则不设置
    if (room.controller.level < 7) return;
    const labs = room.lab;
    if (!labs || labs.length < 7) return;
    // 设置考虑距离，有两个lab处在中心，即相对所有lab距离都在2格以内 并且labA与labB相距最小
    let centerLabs: StructureLab[] = [];
    for (let i = 0; i < labs.length; i++) {
        const lab1 = labs[i];
        let count = 0;
        for (let j = 0; j < labs.length; j++) {
            if (i === j) continue;
            const lab2 = labs[j];
            if (lab1.pos.inRangeTo(lab2.pos, 2)) {
                count++;
            }
        }
        if (count >= labs.length - 3) {
            centerLabs.push(lab1);
        }
    }
    if (centerLabs.length < 2) return;
    // 选择两个距离最小的作为labA和labB
    let minDist = Infinity;
    let labA: StructureLab = centerLabs[0];
    let labB: StructureLab = centerLabs[1];
    for (let i = 0; i < centerLabs.length; i++) {
        for (let j = i + 1; j < centerLabs.length; j++) {
            const dist = centerLabs[i].pos.getRangeTo(centerLabs[j].pos);
            if (dist < minDist) {
                minDist = dist;
                labA = centerLabs[i];
                labB = centerLabs[j];
            }
        }
    }
    const botmem = Memory['StructControlData'][room.name];
    console.log(`[自动Lab合成] ${room.name}设置labA: ${labA.id}, labB: ${labB.id}`);
    botmem.labA = labA.id;
    botmem.labB = labB.id;
    // lab数量更新后同步labNum
    botmem.labNum = labs.length;
}