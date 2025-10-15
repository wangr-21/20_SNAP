const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// 在内存中缓存数据
let graphData = null;
let rawDataStats = null;

// 加载数据到内存
function loadData() {
    try {
        const dataPath = path.join(__dirname, '../data/graph_data.json');
        const rawData = fs.readFileSync(dataPath, 'utf8');
        graphData = JSON.parse(rawData);
        console.log(`数据加载成功: ${graphData.nodes.length} 个节点, ${graphData.links.length} 条边`);
    } catch (error) {
        console.error('数据加载失败:', error);
        graphData = { nodes: [], links: [] };
    }
}

// 初始化时加载数据
loadData();

// 获取图数据（支持采样以提升性能）
router.get('/graph-data', (req, res) => {
    try {
        const sampleSize = parseInt(req.query.sample) || 500; // 默认采样500个节点
        const { nodes, links } = getSampledData(sampleSize);
        
        res.json({
            success: true,
            data: { nodes, links },
            totalNodes: graphData.nodes.length,
            totalEdges: graphData.links.length,
            sampledNodes: nodes.length,
            sampledEdges: links.length,
            message: '数据获取成功'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '数据读取失败: ' + error.message
        });
    }
});

// 获取完整数据统计
router.get('/stats', (req, res) => {
    try {
        if (!rawDataStats) {
            calculateStats();
        }
        
        res.json({
            success: true,
            stats: rawDataStats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '统计数据获取失败: ' + error.message
        });
    }
});

// 获取节点详情
router.get('/node/:id', (req, res) => {
    try {
        const nodeId = parseInt(req.params.id);
        const node = graphData.nodes.find(n => n.id === nodeId);
        
        if (!node) {
            return res.status(404).json({
                success: false,
                message: '节点不存在'
            });
        }
        
        // 查找该节点的连接
        const connections = graphData.links
            .filter(link => link.source === nodeId || link.target === nodeId)
            .map(link => link.source === nodeId ? link.target : link.source);
        
        // 计算聚类系数（局部）
        const clusteringCoefficient = calculateClusteringCoefficient(nodeId);
        
        res.json({
            success: true,
            node: {
                id: node.id,
                name: node.name,
                group: node.group,
                degree: node.degree,
                connections: connections.slice(0, 50), // 只返回前50个连接
                totalConnections: connections.length,
                clusteringCoefficient: clusteringCoefficient
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '节点信息获取失败: ' + error.message
        });
    }
});

// 获取社区统计
router.get('/communities', (req, res) => {
    try {
        const communityStats = {};
        
        graphData.nodes.forEach(node => {
            if (!communityStats[node.group]) {
                communityStats[node.group] = {
                    count: 0,
                    totalDegree: 0
                };
            }
            communityStats[node.group].count++;
            communityStats[node.group].totalDegree += node.degree;
        });
        
        // 计算平均度数
        Object.keys(communityStats).forEach(group => {
            communityStats[group].avgDegree = 
                communityStats[group].totalDegree / communityStats[group].count;
        });
        
        res.json({
            success: true,
            communities: communityStats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '社区统计获取失败: ' + error.message
        });
    }
});

// 辅助函数：数据采样
function getSampledData(sampleSize) {
    if (sampleSize >= graphData.nodes.length) {
        return graphData;
    }
    
    // 使用度数作为采样权重（偏好选择高度数节点）
    const sampledNodes = [];
    const sampledNodeIds = new Set();
    
    // 首先选择度数最高的节点
    const sortedNodes = [...graphData.nodes].sort((a, b) => b.degree - a.degree);
    const topNodes = sortedNodes.slice(0, Math.min(sampleSize / 2, sortedNodes.length));
    
    topNodes.forEach(node => {
        sampledNodes.push(node);
        sampledNodeIds.add(node.id);
    });
    
    // 随机选择剩余节点
    const remainingNodes = graphData.nodes.filter(node => !sampledNodeIds.has(node.id));
    const randomNodes = remainingNodes
        .sort(() => Math.random() - 0.5)
        .slice(0, sampleSize - sampledNodes.length);
    
    randomNodes.forEach(node => {
        sampledNodes.push(node);
        sampledNodeIds.add(node.id);
    });
    
    // 选择连接采样节点的边
    const sampledLinks = graphData.links.filter(link => 
        sampledNodeIds.has(link.source) && sampledNodeIds.has(link.target)
    );
    
    return {
        nodes: sampledNodes,
        links: sampledLinks
    };
}

// 计算统计数据
function calculateStats() {
    const degrees = graphData.nodes.map(node => node.degree);
    const maxDegree = Math.max(...degrees);
    const minDegree = Math.min(...degrees);
    const avgDegree = degrees.reduce((a, b) => a + b, 0) / degrees.length;
    
    // 计算网络密度
    const n = graphData.nodes.length;
    const possibleEdges = n * (n - 1) / 2;
    const density = graphData.links.length / possibleEdges;
    
    rawDataStats = {
        totalNodes: n,
        totalEdges: graphData.links.length,
        maxDegree,
        minDegree,
        avgDegree: avgDegree.toFixed(2),
        density: density.toFixed(6),
        diameter: '计算中...', // 实际计算直径很耗时
        avgClustering: calculateAverageClustering().toFixed(4)
    };
}

// 计算聚类系数
function calculateClusteringCoefficient(nodeId) {
    const neighbors = graphData.links
        .filter(link => link.source === nodeId || link.target === nodeId)
        .map(link => link.source === nodeId ? link.target : link.source);
    
    if (neighbors.length < 2) return 0;
    
    let triangles = 0;
    const neighborSet = new Set(neighbors);
    
    // 检查邻居之间的连接
    neighbors.forEach(neighbor => {
        const neighborConnections = graphData.links
            .filter(link => 
                (link.source === neighbor && neighborSet.has(link.target)) ||
                (link.target === neighbor && neighborSet.has(link.source))
            )
            .map(link => link.source === neighbor ? link.target : link.source);
        
        triangles += neighborConnections.length;
    });
    
    triangles = triangles / 2; // 每条边被计算了两次
    
    const possibleTriangles = neighbors.length * (neighbors.length - 1) / 2;
    return possibleTriangles > 0 ? triangles / possibleTriangles : 0;
}

// 计算平均聚类系数
function calculateAverageClustering() {
    let totalCoefficient = 0;
    let count = 0;
    
    // 只计算前1000个节点以提升性能
    const sampleNodes = graphData.nodes.slice(0, Math.min(1000, graphData.nodes.length));
    
    sampleNodes.forEach(node => {
        totalCoefficient += calculateClusteringCoefficient(node.id);
        count++;
    });
    
    return count > 0 ? totalCoefficient / count : 0;
}

module.exports = router;