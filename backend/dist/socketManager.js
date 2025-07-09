"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSocketIO = exports.setSocketIO = void 0;
let io;
const setSocketIO = (socketInstance) => {
    io = socketInstance;
};
exports.setSocketIO = setSocketIO;
const getSocketIO = () => {
    if (!io) {
        throw new Error('Socket.IO not initialized');
    }
    return io;
};
exports.getSocketIO = getSocketIO;
//# sourceMappingURL=socketManager.js.map