
const upgrade = function (creep: Creep) {
    const link = creep.room.link.find(l => l.pos.inRangeTo(creep.room.controller, 2))
    if (link && !creep.pos.inRangeTo(link, 1)) {
        creep.moveTo(link, {
            visualizePathStyle: { stroke: '#ffffff' },
            range: 1,
            maxRooms: 1,
        });
    }
    if (!link && !creep.pos.inRangeTo(creep.room.controller, 2)) {
        creep.moveTo(creep.room.controller.pos, {
            visualizePathStyle: { stroke: '#ffffff' },
            range: 2,
            maxRooms: 1,
        });
    }
    if (creep.pos.inRangeTo(creep.room.controller, 3)) {
        creep.upgradeController(creep.room.controller)
        const botMem = Memory['RoomControlData'][creep.room.name];
        const sign = botMem?.sign ?? global.BASE_CONFIG.DEFAULT_SIGN;
        const oldSign = creep.room.controller.sign?.text ?? '';
        if (creep.room.controller && sign && oldSign != sign) {
            if (creep.pos.inRangeTo(creep.room.controller, 1)) {
                creep.signController(creep.room.controller, sign);
            } else {
                creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffffff' } })
            }
        }
        // 如果当前creep在road上，尽量往controller旁边Container方向移动 防止堵路
        const road = creep.pos.lookFor(LOOK_STRUCTURES).find(s => s.structureType === STRUCTURE_ROAD);
        if (road) {
            const container = creep.room.container.find(c => c.pos.inRangeTo(creep.room.controller, 2));
            // 如果container上已经存在creep，则移动到controller旁边
            const containerCreep = container?.pos.lookFor(LOOK_CREEPS).find(c => c.id !== creep.id);
            if (container && containerCreep) {
                // 移到一个没有creep的controller旁边位置，先得到位置，尽可能与controller和container同时相邻
                // 注意 位置上不能有墙，不能有creep 必须与controller在2格范围内 必须与container在1格范围内 不要使用adjacentTo方法
                const positions = [];
                for (let x = container.pos.x - 1; x <= container.pos.x + 1; x++) {
                    for (let y = container.pos.y - 1; y <= container.pos.y + 1; y++) {
                        const pos = new RoomPosition(x, y, creep.room.name);
                        if (pos.isNearTo(container.pos) && pos.inRangeTo(creep.room.controller.pos, 2)) {
                            positions.push(pos);
                        }
                    }
                }
                // 过滤掉有墙和creep的位置
                const validPositions = positions.filter(p => {
                    const structures = p.lookFor(LOOK_STRUCTURES);
                    const creeps = p.lookFor(LOOK_CREEPS);
                    return !structures.some(s => s.structureType === STRUCTURE_WALL) && creeps.length === 0;
                });
                // console.log(creep.name + ' upgrader road move to validPositions: ' + JSON.stringify(validPositions));
                if (validPositions.length > 0) {
                    // 找到距离当前creep最近的位置
                    const targetPos = validPositions.reduce((prev, curr) => {
                        return prev.getRangeTo(creep) < curr.getRangeTo(creep) ? prev : curr;
                    });
                    creep.moveTo(targetPos, { visualizePathStyle: { stroke: '#ffffff' } });
                }
            } else if (container) {
                creep.moveTo(container, { visualizePathStyle: { stroke: '#ffffff' } });
            }
        }

        return;
    }
}

const Upgrader = {
    prepare: function (creep: Creep) {
        if (creep.room.level == 8) return true;
        return creep.goBoost(['XGH2O', 'GH2O', 'GH']);
    },

    target: function (creep: Creep) {   // 升级控制器
        if (!creep.memory.ready) return false;
        if (!creep.moveHomeRoom()) return;
        upgrade(creep);
        if (creep.store.getUsedCapacity() === 0) {
            creep.say('🔄');
            return true;
        } else { return false; }
    },

    source: function (creep: Creep) {   // 获取能量
        if (!creep.memory.ready) return false;
        if (!creep.moveHomeRoom()) return;

        const link = creep.room.link.find(l => l.pos.inRangeTo(creep.room.controller, 2)) || null;
        const container = creep.room.container.find(l => l.pos.inRangeTo(creep.room.controller, 2)) ?? null;

        if (link && link.store[RESOURCE_ENERGY] > 0) {
            creep.goWithdraw(link, RESOURCE_ENERGY);
        }
        else if (container && container.store[RESOURCE_ENERGY] > 0) {
            creep.goWithdraw(container, RESOURCE_ENERGY);
        }
        else if (!link || creep.room.level < 6) { creep.TakeEnergy() }

        if (creep.store.getFreeCapacity() === 0) {
            creep.say('⚡');
            return true;
        } else { return false; }
    },
}

export default Upgrader;

