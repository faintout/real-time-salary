"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const salaryCalculator_1 = require("./salaryCalculator");
let salaryCalculator;
function activate(context) {
    console.log('实时工资计算器插件已激活');
    try {
        // 创建工资计算器实例
        salaryCalculator = new salaryCalculator_1.SalaryCalculator();
        console.log('SalaryCalculator 实例创建成功');
        // 注册命令
        const startCommand = vscode.commands.registerCommand('real-time-salary.start', () => {
            console.log('执行开始命令');
            salaryCalculator?.start();
            vscode.window.showInformationMessage('实时工资计算已开始');
        });
        const stopCommand = vscode.commands.registerCommand('real-time-salary.stop', () => {
            console.log('执行停止命令');
            salaryCalculator?.stop();
            vscode.window.showInformationMessage('实时工资计算已停止');
        });
        const settingsCommand = vscode.commands.registerCommand('real-time-salary.settings', () => {
            console.log('执行设置命令');
            vscode.commands.executeCommand('workbench.action.openSettings', 'realTimeSalary');
        });
        const updateHolidaysCommand = vscode.commands.registerCommand('real-time-salary.updateHolidays', async () => {
            console.log('执行更新节假日命令');
            try {
                await salaryCalculator?.updateHolidays();
                vscode.window.showInformationMessage('节假日信息更新成功');
            }
            catch (error) {
                console.error('更新节假日失败:', error);
                vscode.window.showErrorMessage(`更新节假日信息失败: ${error}`);
            }
        });
        // 添加到上下文订阅
        context.subscriptions.push(startCommand, stopCommand, settingsCommand, updateHolidaysCommand);
        console.log('命令注册完成');
        // 插件激活时自动开始计算
        console.log('准备自动启动工资计算');
        salaryCalculator.start();
        console.log('工资计算已启动');
    }
    catch (error) {
        console.error('插件激活失败:', error);
        vscode.window.showErrorMessage(`插件激活失败: ${error}`);
    }
}
exports.activate = activate;
function deactivate() {
    salaryCalculator?.stop();
    console.log('实时工资计算器插件已停用');
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map