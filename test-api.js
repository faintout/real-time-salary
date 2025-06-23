const http = require('http');
const https = require('https');
const { URL } = require('url');
const zlib = require('zlib');

async function testAPI() {
    const url = 'http://timor.tech/api/holiday/year/2025';
    console.log(`测试API: ${url}`);
    
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
        
        console.log('请求选项:', JSON.stringify(options, null, 2));
        
        const req = client.request(options, (res) => {
            console.log(`状态码: ${res.statusCode}`);
            console.log(`状态消息: ${res.statusMessage}`);
            console.log(`响应头:`, JSON.stringify(res.headers, null, 2));
            
            let data = '';
            let stream = res;
            
            // 处理压缩响应
            const encoding = res.headers['content-encoding'];
            if (encoding === 'gzip') {
                console.log('检测到gzip压缩，正在解压...');
                stream = res.pipe(zlib.createGunzip());
            } else if (encoding === 'deflate') {
                console.log('检测到deflate压缩，正在解压...');
                stream = res.pipe(zlib.createInflate());
            } else if (encoding === 'br') {
                console.log('检测到brotli压缩，正在解压...');
                stream = res.pipe(zlib.createBrotliDecompress());
            }
            
            stream.on('data', (chunk) => {
                data += chunk;
            });
            
            stream.on('end', () => {
                console.log(`响应数据长度: ${data.length}`);
                console.log(`响应前200个字符: ${data.substring(0, 200)}`);
                
                if (res.statusCode !== 200) {
                    console.error(`HTTP错误: ${res.statusCode} ${res.statusMessage}`);
                    console.error(`响应内容: ${data}`);
                    reject(new Error(`HTTP错误: ${res.statusCode}`));
                    return;
                }
                
                try {
                    const jsonData = JSON.parse(data);
                    console.log('JSON解析成功');
                    console.log(`响应码: ${jsonData.code}`);
                    if (jsonData.holiday) {
                        const holidayCount = Object.keys(jsonData.holiday).length;
                        console.log(`节假日数据条数: ${holidayCount}`);
                        
                        // 显示前5条数据
                        const entries = Object.entries(jsonData.holiday).slice(0, 5);
                        console.log('前5条节假日数据:');
                        entries.forEach(([date, info]) => {
                            console.log(`  ${date}: ${JSON.stringify(info)}`);
                        });
                    }
                    resolve(jsonData);
                } catch (parseError) {
                    console.error('JSON解析失败:', parseError);
                    console.error('原始数据:', data);
                    reject(parseError);
                }
            });
            
            stream.on('error', (error) => {
                console.error('数据流错误:', error);
                reject(error);
            });
        });
        
        req.on('error', (error) => {
            console.error('请求错误:', error);
            reject(error);
        });
        
        req.setTimeout(15000, () => {
            console.error('请求超时');
            req.destroy();
            reject(new Error('请求超时'));
        });
        
        req.end();
    });
}

// 运行测试
testAPI()
    .then(() => {
        console.log('API测试成功');
    })
    .catch((error) => {
        console.error('API测试失败:', error);
    }); 