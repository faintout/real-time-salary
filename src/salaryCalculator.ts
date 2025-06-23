import * as vscode from 'vscode';
import { HolidayService } from './holidayService';

export class SalaryCalculator {
    private statusBarItem: vscode.StatusBarItem;
    private timer: NodeJS.Timeout | undefined;
    private isRunning: boolean = false;
    private holidayService: HolidayService;
    private workDaysCache: Map<string, number> = new Map(); // 缓存每月工作天数

    constructor() {
        // 创建状态栏项目
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right, 
            100
        );
        this.statusBarItem.command = 'real-time-salary.settings';
        this.statusBarItem.tooltip = '点击打开工资计算设置';
        
        // 初始化节假日服务
        this.holidayService = new HolidayService();
    }

    public start(): void {
        console.log('SalaryCalculator.start() 被调用');
        
        if (this.isRunning) {
            console.log('计算器已经在运行中，跳过启动');
            return;
        }

        console.log('开始启动工资计算器');
        this.isRunning = true;
        
        // 初始化节假日服务
        this.holidayService.initialize().catch(error => {
            console.error('节假日服务初始化失败:', error);
        });
        
        // 每秒更新一次
        this.timer = setInterval(() => {
            this.updateSalary();
        }, 1000);
        console.log('定时器已设置');

        // 立即更新一次
        console.log('执行首次更新');
        this.updateSalary();
        console.log('工资计算器启动完成');
    }

    public stop(): void {
        this.isRunning = false;
        this.statusBarItem.hide();
        
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
    }

    private async updateSalary(): Promise<void> {
        console.log('updateSalary() 开始执行');
        
        // 检查是否需要清理缓存（月份变化时）
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
        const cacheKeys = Array.from(this.workDaysCache.keys());
        const shouldClearCache = cacheKeys.length > 0 && !cacheKeys.some(key => key.startsWith(currentMonthKey));
        
        if (shouldClearCache) {
            console.log('检测到月份变化，清理工作天数缓存');
            this.workDaysCache.clear();
        }
        
        const config = vscode.workspace.getConfiguration('realTimeSalary');
        const monthlySalary = config.get<number>('monthlySalary', 10000);
        const workStartTime = config.get<string>('workStartTime', '09:00');
        const workEndTime = config.get<string>('workEndTime', '18:00');
        const workDaysPerWeek = config.get<number>('workDaysPerWeek', 5);
        const offWorkMessage = config.get<string>('offWorkMessage', ' 💰下班啦！');
        const autoFetchHolidays = config.get<boolean>('autoFetchHolidays', true);
        const manualHolidays = config.get<string[]>('holidays', []);
        const manualWorkdays = config.get<string[]>('workdays', []);
        const salaryPrefix = config.get<string>('salaryPrefix', '实时💲：');

        console.log('配置读取完成:', { monthlySalary, workStartTime, workEndTime, workDaysPerWeek, salaryPrefix });

        console.log('当前时间:', now.toLocaleString());
        
        // 检查是否为工作日
        const isWorkDay = await this.isWorkDay(now, workDaysPerWeek, autoFetchHolidays, manualHolidays, manualWorkdays);
        if (!isWorkDay) {
            // 非工作日，显示非工作日状态
            this.statusBarItem.text = `$(calendar) 非工作日`;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.inactiveBackground');
            this.statusBarItem.show();
            return;
        }

        // 解析工作时间
        const startTime = this.parseTime(workStartTime);
        const endTime = this.parseTime(workEndTime);
        
        if (!startTime || !endTime) {
            // 时间解析错误，显示错误状态
            this.statusBarItem.text = `$(warning) 时间配置错误`;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            this.statusBarItem.show();
            return;
        }

        // 创建今天的开始和结束时间
        const todayStart = new Date(now);
        todayStart.setHours(startTime.hours, startTime.minutes, 0, 0);
        
        const todayEnd = new Date(now);
        todayEnd.setHours(endTime.hours, endTime.minutes, 0, 0);

        // 检查当前时间状态
        if (now < todayStart) {
            // 还没到上班时间，显示0元收入
            this.statusBarItem.text = `$(symbol-currency) ${salaryPrefix}0.00 元`;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.inactiveBackground');
            this.statusBarItem.show();
            return;
        } else if (now > todayEnd) {
            // 已经下班，显示下班消息
            const salary = await this.calculateDailySalary(
                monthlySalary,
                startTime,
                endTime,
                workDaysPerWeek,
                autoFetchHolidays,
                manualHolidays,
                manualWorkdays
            );
            this.statusBarItem.text = `$(symbol-currency) ${salaryPrefix}${salary.toFixed(2)} 元 ${offWorkMessage}`;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
            this.statusBarItem.show();
            return;
        } else {
            // 工作时间内，显示实时工资
            const salary = await this.calculateCurrentSalary(
                now,
                monthlySalary,
                workStartTime,
                workEndTime,
                workDaysPerWeek,
                autoFetchHolidays,
                manualHolidays,
                manualWorkdays
            );
            
            if (salary !== null) {
                this.statusBarItem.text = `$(symbol-currency) ${salaryPrefix}${salary.toFixed(2)} 元`;
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.activeBackground');
                this.statusBarItem.show();
            } else {
                // 计算错误，显示错误状态
                this.statusBarItem.text = `$(warning) 计算错误`;
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
                this.statusBarItem.show();
            }
        }
    }

    private async calculateDailySalary(
        monthlySalary: number,
        startTime: { hours: number; minutes: number },
        endTime: { hours: number; minutes: number },
        workDaysPerWeek: number,
        autoFetchHolidays: boolean,
        manualHolidays: string[],
        manualWorkdays: string[]
    ): Promise<number> {
        const now = new Date();
        const totalWorkMinutes = this.getTotalWorkMinutes(startTime, endTime);
        const workDaysInMonth = await this.getWorkDaysInMonth(now, workDaysPerWeek, autoFetchHolidays, manualHolidays, manualWorkdays);
        const salaryPerMinute = monthlySalary / (workDaysInMonth * totalWorkMinutes);
        return totalWorkMinutes * salaryPerMinute;
    }

    private async calculateCurrentSalary(
        currentTime: Date,
        monthlySalary: number,
        workStartTime: string,
        workEndTime: string,
        workDaysPerWeek: number,
        autoFetchHolidays: boolean,
        manualHolidays: string[],
        manualWorkdays: string[]
    ): Promise<number | null> {
        // 解析工作时间
        const startTime = this.parseTime(workStartTime);
        const endTime = this.parseTime(workEndTime);
        
        if (!startTime || !endTime) {
            return null;
        }

        // 创建今天的开始时间
        const todayStart = new Date(currentTime);
        todayStart.setHours(startTime.hours, startTime.minutes, 0, 0);

        // 计算工作进度（不包含午休）
        const totalWorkMinutes = this.getTotalWorkMinutes(startTime, endTime);
        const workedMinutes = this.getWorkedMinutes(todayStart, currentTime);
        
        // 计算当月工作天数（排除节假日）
        const workDaysInMonth = await this.getWorkDaysInMonth(currentTime, workDaysPerWeek, autoFetchHolidays, manualHolidays, manualWorkdays);
        
        // 计算每分钟工资
        const salaryPerMinute = monthlySalary / (workDaysInMonth * totalWorkMinutes);
        
        // 返回当前已赚取的工资
        return workedMinutes * salaryPerMinute;
    }

    private parseTime(timeStr: string): { hours: number; minutes: number } | null {
        const parts = timeStr.split(':');
        if (parts.length !== 2) {
            return null;
        }

        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);

        if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            return null;
        }

        return { hours, minutes };
    }

    private async isWorkDay(
        date: Date, 
        workDaysPerWeek: number, 
        autoFetchHolidays: boolean,
        manualHolidays: string[], 
        manualWorkdays: string[]
    ): Promise<boolean> {
        const dateStr = this.formatDate(date);
        
        if (autoFetchHolidays) {
            // 使用API获取的数据
            // 检查是否为调休工作日
            if (await this.holidayService.isWorkday(date)) {
                return true;
            }
            
            // 检查是否为节假日
            if (await this.holidayService.isHoliday(date)) {
                return false;
            }
        } else {
            // 使用手动配置的数据
            // 检查是否为调休工作日
            if (manualWorkdays.includes(dateStr)) {
                return true;
            }
            
            // 检查是否为节假日
            if (manualHolidays.includes(dateStr)) {
                return false;
            }
        }
        
        const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        
        if (workDaysPerWeek === 5) {
            // 工作日：周一到周五
            return dayOfWeek >= 1 && dayOfWeek <= 5;
        } else if (workDaysPerWeek === 6) {
            // 工作日：周一到周六
            return dayOfWeek >= 1 && dayOfWeek <= 6;
        } else if (workDaysPerWeek === 7) {
            // 每天都工作
            return true;
        }
        
        // 默认周一到周五
        return dayOfWeek >= 1 && dayOfWeek <= 5;
    }

    private formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    private getTotalWorkMinutes(
        startTime: { hours: number; minutes: number },
        endTime: { hours: number; minutes: number }
    ): number {
        const startMinutes = startTime.hours * 60 + startTime.minutes;
        const endMinutes = endTime.hours * 60 + endTime.minutes;
        return Math.max(0, endMinutes - startMinutes);
    }

    private getWorkedMinutes(startTime: Date, currentTime: Date): number {
        const workedMilliseconds = currentTime.getTime() - startTime.getTime();
        const workedMinutes = workedMilliseconds / (1000 * 60);
        return Math.max(0, workedMinutes);
    }

    private async getWorkDaysInMonth(
        date: Date, 
        workDaysPerWeek: number, 
        autoFetchHolidays: boolean,
        manualHolidays: string[], 
        manualWorkdays: string[]
    ): Promise<number> {
        const year = date.getFullYear();
        const month = date.getMonth();
        
        // 创建缓存键
        const cacheKey = `${year}-${month}-${workDaysPerWeek}-${autoFetchHolidays}-${JSON.stringify(manualHolidays)}-${JSON.stringify(manualWorkdays)}`;
        
        // 检查缓存
        if (this.workDaysCache.has(cacheKey)) {
            console.log(`从缓存获取${year}年${month + 1}月工作天数`);
            return this.workDaysCache.get(cacheKey)!;
        }
        
        console.log(`计算${year}年${month + 1}月工作天数`);
        
        // 获取当月天数
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        let workDays = 0;
        
        for (let day = 1; day <= daysInMonth; day++) {
            const checkDate = new Date(year, month, day);
            if (await this.isWorkDay(checkDate, workDaysPerWeek, autoFetchHolidays, manualHolidays, manualWorkdays)) {
                workDays++;
            }
        }
        
        // 缓存结果
        this.workDaysCache.set(cacheKey, workDays);
        console.log(`${year}年${month + 1}月工作天数: ${workDays}天，已缓存`);
        
        return workDays;
    }

    public async updateHolidays(): Promise<void> {
        const currentYear = new Date().getFullYear();
        await this.holidayService.updateCache(currentYear);
    }

    public dispose(): void {
        this.stop();
        this.statusBarItem.dispose();
    }
} 