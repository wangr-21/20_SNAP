// backend/data/download_data.js
const fs = require('fs');
const path = require('path');

const RAW_DATA_FILE = path.join(__dirname, 'facebook_combined.txt');
const GRAPH_DATA_FILE = path.join(__dirname, 'graph_data.json');

function processRealData() {
    console.log('处理真实Facebook数据集...');
    
    try {
        // 检查文件是否存在
        if (!fs.existsSync(RAW_DATA_FILE)) {
            console.error('错误: 真实数据文件不存在:', RAW_DATA_FILE);
            console.log('请确保 facebook_combined.txt 文件位于 backend/data/ 目录下');
            return;
        }
        
        console.log('读取文件:', RAW_DATA_FILE);
        const rawData = fs.readFileSync(RAW_DATA_FILE, 'utf8');
        const lines = rawData.split('\n');
        
        console.log(`文件总行数: ${lines.length}`);
        
        // 过滤掉注释行和空行
        const dataLines = lines.filter(line => {
            const trimmed = line.trim();
            return trimmed && !trimmed.startsWith('#') && trimmed.length > 0;
        });
        
        console.log(`有效数据行数: ${dataLines.length}`);
        
        // 调试：显示前几行数据
        console.log('前5行数据示例:');
        dataLines.slice(0, 5).forEach((line, index) => {
            console.log(`  ${index + 1}: "${line}"`);
        });
        
        const nodesMap = new Map();
        const links = [];
        let errorCount = 0;
        
        // 处理每一行数据
        dataLines.forEach((line, index) => {
            try {
                const parts = line.trim().split(/\s+/); // 使用空白字符分割
                
                if (parts.length < 2) {
                    console.log(`跳过第${index + 1}行: 列数不足 - "${line}"`);
                    errorCount++;
                    return;
                }
                
                const source = parseInt(parts[0]);
                const target = parseInt(parts[1]);
                
                if (isNaN(source) || isNaN(target)) {
                    console.log(`跳过第${index + 1}行: 数字解析失败 - "${line}"`);
                    errorCount++;
                    return;
                }
                
                // 创建或更新源节点
                if (!nodesMap.has(source)) {
                    nodesMap.set(source, {
                        id: source,
                        name: `用户${source}`,
                        group: (source % 8) + 1, // 基于ID分配社区
                        degree: 0
                    });
                }
                
                // 创建或更新目标节点
                if (!nodesMap.has(target)) {
                    nodesMap.set(target, {
                        id: target,
                        name: `用户${target}`,
                        group: (target % 8) + 1, // 基于ID分配社区
                        degree: 0
                    });
                }
                
                // 添加边
                links.push({
                    source: source,
                    target: target,
                    value: 1
                });
                
                // 更新度数
                nodesMap.get(source).degree++;
                nodesMap.get(target).degree++;
                
            } catch (error) {
                console.log(`处理第${index + 1}行时出错: "${line}" - ${error.message}`);
                errorCount++;
            }
        });
        
        const nodes = Array.from(nodesMap.values());
        
        console.log(`\n处理完成:`);
        console.log(`  - 成功处理: ${nodes.length} 个节点, ${links.length} 条边`);
        console.log(`  - 错误行数: ${errorCount}`);
        console.log(`  - 成功率: ${((dataLines.length - errorCount) / dataLines.length * 100).toFixed(2)}%`);
        
        if (nodes.length === 0) {
            console.error('\n错误: 没有找到任何有效的节点数据！');
            console.log('可能的原因:');
            console.log('  1. 数据文件格式不正确');
            console.log('  2. 数据文件为空或损坏');
            console.log('  3. 文件编码问题');
            return;
        }
        
        // 保存处理后的数据
        const graphData = { nodes, links };
        fs.writeFileSync(GRAPH_DATA_FILE, JSON.stringify(graphData, null, 2));
        
        console.log('\n真实数据集处理完成!');
        console.log(`JSON数据文件: ${GRAPH_DATA_FILE}`);
        
        // 显示详细的统计信息
        displayStatistics(nodes, links);
        
    } catch (error) {
        console.error('处理真实数据时出错:', error);
    }
}

function displayStatistics(nodes, links) {
    console.log('\n=== 数据集统计信息 ===');
    console.log(`总节点数: ${nodes.length}`);
    console.log(`总边数: ${links.length}`);
    
    // 计算度数统计
    const degrees = nodes.map(node => node.degree);
    const maxDegree = Math.max(...degrees);
    const minDegree = Math.min(...degrees);
    const avgDegree = degrees.reduce((a, b) => a + b, 0) / degrees.length;
    
    console.log(`最大度数: ${maxDegree}`);
    console.log(`最小度数: ${minDegree}`);
    console.log(`平均度数: ${avgDegree.toFixed(2)}`);
    
    // 计算网络密度
    const n = nodes.length;
    const possibleEdges = n * (n - 1) / 2;
    const density = links.length / possibleEdges;
    console.log(`网络密度: ${density.toFixed(6)}`);
    
    // 度数分布
    const degreeDistribution = {};
    degrees.forEach(degree => {
        degreeDistribution[degree] = (degreeDistribution[degree] || 0) + 1;
    });
    
    console.log(`不同度数的数量: ${Object.keys(degreeDistribution).length}`);
    
    // 社区分布
    const communityDist = {};
    nodes.forEach(node => {
        communityDist[node.group] = (communityDist[node.group] || 0) + 1;
    });
    console.log('社区分布:', communityDist);
    
    // 显示前10个高度数节点
    const topNodes = [...nodes].sort((a, b) => b.degree - a.degree).slice(0, 10);
    console.log('\n前10个高度数节点:');
    topNodes.forEach((node, index) => {
        console.log(`  ${index + 1}. 节点${node.id} (度数: ${node.degree})`);
    });
}

// 直接处理真实数据
processRealData();