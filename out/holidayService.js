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
exports.HolidayService = void 0;
const vscode = __importStar(require("vscode"));
class HolidayService {
    constructor() {
        this.cache = new Map();
        this.API_URL = 'http://timor.tech/api/holiday/year/';
        this.isInitialized = false;
        this.initializationPromise = null;
    }
    /**
     * 初始化节假日数据（仅在启动时执行一次）
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        if (this.initializationPromise) {
            return this.initializationPromise;
        }
        this.initializationPromise = this.performInitialization();
        return this.initializationPromise;
    }
    async performInitialization() {
        const currentYear = new Date().getFullYear();
        console.log(`开始初始化节假日数据，当前年份: ${currentYear}`);
        try {
            await this.fetchHolidayDataWithRetry(currentYear, 3);
            console.log('节假日数据初始化成功');
        }
        catch (error) {
            console.error('节假日数据初始化失败，将使用本地配置:', error);
            vscode.window.showWarningMessage('获取节假日信息失败，将使用本地配置');
        }
        finally {
            this.isInitialized = true;
        }
    }
    /**
     * 获取指定年份的节假日数据
     */
    async getHolidayData(year) {
        // 确保已初始化
        await this.initialize();
        const cacheKey = year.toString();
        // 检查缓存
        if (this.cache.has(cacheKey)) {
            console.log(`从缓存获取${year}年节假日数据`);
            return this.cache.get(cacheKey);
        }
        // 如果缓存中没有数据，返回空数组（使用手动配置）
        console.log(`缓存中没有${year}年数据，使用手动配置`);
        return [];
    }
    /**
     * 带重试机制的数据获取（仅在初始化时使用）
     */
    async fetchHolidayDataWithRetry(year, maxRetries) {
        let lastError = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`第${attempt}次尝试获取${year}年节假日数据`);
                const data = await this.fetchHolidayData(year);
                // 成功获取数据，保存到缓存
                this.cache.set(year.toString(), data);
                console.log(`成功获取并缓存${year}年节假日数据，共${data.length}条`);
                return data;
            }
            catch (error) {
                lastError = error;
                console.warn(`第${attempt}次尝试失败:`, error);
                if (attempt < maxRetries) {
                    console.log(`等待3秒后进行第${attempt + 1}次重试`);
                    await new Promise(resolve => setTimeout(resolve, 3000)); // 固定等待3秒
                }
            }
        }
        // 所有重试都失败了，保存空数组到缓存
        this.cache.set(year.toString(), []);
        throw lastError || new Error('重试次数已用完');
    }
    /**
     * 检查指定日期是否为节假日
     * @param date 日期
     * @returns 是否为节假日
     */
    async isHoliday(date) {
        const year = date.getFullYear();
        const holidayData = await this.getHolidayData(year);
        const dateStr = this.formatDate(date);
        return holidayData.some(item => item.date === dateStr && item.type === 'holiday');
    }
    /**
     * 检查指定日期是否为调休工作日
     * @param date 日期
     * @returns 是否为调休工作日
     */
    async isWorkday(date) {
        const year = date.getFullYear();
        const holidayData = await this.getHolidayData(year);
        const dateStr = this.formatDate(date);
        return holidayData.some(item => item.date === dateStr && item.type === 'workday');
    }
    /**
     * 获取当年所有节假日
     * @param year 年份
     * @returns 节假日日期数组
     */
    async getHolidays(year) {
        const holidayData = await this.getHolidayData(year);
        return holidayData
            .filter(item => item.type === 'holiday')
            .map(item => item.date);
    }
    /**
     * 获取当年所有调休工作日
     * @param year 年份
     * @returns 调休工作日日期数组
     */
    async getWorkdays(year) {
        const holidayData = await this.getHolidayData(year);
        return holidayData
            .filter(item => item.type === 'workday')
            .map(item => item.date);
    }
    async fetchHolidayData(year) {
        const url = `${this.API_URL}${year}`;
        console.log(`正在请求节假日API: ${url}`);
        try {
            // 使用 node 的 https 模块
            const https = require('https');
            const http = require('http');
            const { URL } = require('url');
            const zlib = require('zlib');
            return new Promise((resolve, reject) => {
                const parsedUrl = new URL(url);
                const client = parsedUrl.protocol === 'https:' ? https : http;
                const options = {
                    hostname: parsedUrl.hostname,
                    port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
                    path: parsedUrl.pathname + parsedUrl.search,
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'application/json, text/plain, */*',
                        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Connection': 'keep-alive',
                        'Cache-Control': 'no-cache'
                    }
                };
                console.log(`请求选项:`, JSON.stringify(options, null, 2));
                const req = client.request(options, (res) => {
                    console.log(`API响应状态码: ${res.statusCode}`);
                    console.log(`API响应头: ${JSON.stringify(res.headers)}`);
                    // 检查状态码
                    if (res.statusCode !== 200) {
                        if (res.statusCode === 429) {
                            reject(new Error(`请求频率过高，请稍后再试 (HTTP ${res.statusCode})`));
                        }
                        else {
                            reject(new Error(`HTTP错误: ${res.statusCode} ${res.statusMessage}`));
                        }
                        return;
                    }
                    let data = '';
                    let stream = res;
                    // 处理压缩响应
                    const encoding = res.headers['content-encoding'];
                    if (encoding === 'gzip') {
                        console.log('检测到gzip压缩，正在解压...');
                        stream = res.pipe(zlib.createGunzip());
                    }
                    else if (encoding === 'deflate') {
                        console.log('检测到deflate压缩，正在解压...');
                        stream = res.pipe(zlib.createInflate());
                    }
                    else if (encoding === 'br') {
                        console.log('检测到brotli压缩，正在解压...');
                        stream = res.pipe(zlib.createBrotliDecompress());
                    }
                    stream.on('data', (chunk) => {
                        data += chunk;
                    });
                    stream.on('end', () => {
                        console.log(`API响应数据长度: ${data.length}`);
                        console.log(`API响应前100个字符: ${data.substring(0, 100)}`);
                        // 检查响应是否为HTML
                        if (data.trim().startsWith('<!DOCTYPE') || data.trim().startsWith('<html')) {
                            console.error('API返回HTML页面而非JSON');
                            reject(new Error('API返回HTML页面而非JSON'));
                            return;
                        }
                        try {
                            const response = JSON.parse(data);
                            console.log(`JSON解析成功，响应码: ${response.code}`);
                            if (response.code === 0 && response.holiday) {
                                const holidayData = [];
                                // 解析节假日数据
                                for (const [dateStr, info] of Object.entries(response.holiday)) {
                                    const holidayInfo = info;
                                    if (holidayInfo.holiday) {
                                        // 节假日
                                        holidayData.push({
                                            date: dateStr,
                                            name: holidayInfo.name || '节假日',
                                            type: 'holiday'
                                        });
                                    }
                                    else if (holidayInfo.after === false && holidayInfo.wage === 3) {
                                        // 调休工作日（工资倍数为3倍的工作日）
                                        holidayData.push({
                                            date: dateStr,
                                            name: holidayInfo.name || '调休工作日',
                                            type: 'workday'
                                        });
                                    }
                                }
                                console.log(`解析到${holidayData.length}条节假日数据`);
                                resolve(holidayData);
                            }
                            else {
                                console.error('API响应格式错误:', response);
                                reject(new Error('API响应格式错误'));
                            }
                        }
                        catch (parseError) {
                            console.error('JSON解析失败:', parseError);
                            console.error('原始响应数据:', data);
                            reject(parseError);
                        }
                    });
                    stream.on('error', (error) => {
                        console.error('数据流错误:', error);
                        reject(error);
                    });
                });
                req.on('error', (error) => {
                    console.error('HTTP请求错误:', error);
                    reject(error);
                });
                req.setTimeout(15000, () => {
                    console.error('HTTP请求超时');
                    req.destroy();
                    reject(new Error('请求超时'));
                });
                req.end();
            });
        }
        catch (error) {
            console.error('fetchHolidayData异常:', error);
            throw error;
        }
    }
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    /**
     * 清除缓存
     */
    clearCache() {
        this.cache.clear();
    }
    /**
     * 更新节假日缓存（手动触发）
     */
    async updateCache(year) {
        this.cache.delete(year.toString());
        await this.getHolidayData(year);
        vscode.window.showInformationMessage(`${year}年节假日信息已更新`);
    }
}
exports.HolidayService = HolidayService;
//# sourceMappingURL=holidayService.js.map