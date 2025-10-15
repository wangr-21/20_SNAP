# SNAP数据集网络可视化项目

## 📊 项目简介

这是一个基于SNAP Facebook社交网络数据集的交互式网络可视化系统。项目使用D3.js进行前端可视化，Node.js+Express作为后端服务器，提供完整的社交网络数据探索和分析功能。

**核心功能**：
- 🔍 交互式网络图探索
- 📈 实时网络统计信息
- 🎨 社区分组着色
- 🔄 动态布局调整
- 📥 数据导出功能

## 🛠 技术栈

| 技术领域 | 使用技术 |
|---------|----------|
| **前端** | HTML5, CSS3, JavaScript, D3.js v7 |
| **后端** | Node.js, Express, CORS |
| **数据** | SNAP Facebook数据集 |
| **可视化** | 力导向图, 交互式图表 |

## 📁 项目结构

```
20_SNAP/
├── backend/                    # 后端服务
│   ├── server.js              # 服务器主文件
│   ├── routes/
│   │   └── data.js            # 数据API路由
│   ├── data/
│   │   ├── download_data.js   # 数据下载和处理脚本
│   │   ├── facebook_combined.txt    # 原始数据文件
│   │   └── graph_data.json          # 处理后的JSON数据
│   └── package.json           # 后端依赖配置
├── frontend/                   # 前端界面
│   ├── index.html             # 主页面
│   ├── css/
│   │   └── style.css          # 样式文件
│   ├── js/
│   │   └── app.js             # 前端逻辑和可视化
│   └── lib/
│       └── d3.v7.min.js       # D3.js可视化库
└── README.md                  # 项目说明文档
```

## 🚀 快速开始

### 环境要求
- Node.js 14.0+
- npm 6.0+

### 安装和运行步骤

#### 1. 安装后端依赖
```bash
cd backend
npm install
```

#### 2. 准备数据
```bash
# 进入数据目录
cd data

# 处理数据集（确保facebook_combined.txt文件已存在）
node download_data.js
```

#### 3. 启动服务
```bash
# 在backend目录下运行
npm start
```

#### 4. 访问应用
打开浏览器访问：http://localhost:3000

### 一键运行脚本
```bash
# 在backend目录下执行以下命令完成所有步骤
npm install && cd data && node download_data.js && cd .. && npm start
```

## ✨ 功能特性

### 🎯 核心功能
- **网络可视化**：基于力导向图的社交网络展示
- **智能采样**：支持不同规模的数据采样（100/200/500/1000节点）
- **交互探索**：节点点击查看详情、鼠标悬停高亮
- **布局控制**：重置布局、冻结/继续模拟、适应视图

### 📊 数据分析
- **实时统计**：节点数、边数、网络密度、平均度数
- **社区发现**：自动识别和着色不同社区
- **节点详情**：度数、连接数、聚类系数等指标

### 🎮 交互功能
- **缩放拖拽**：支持画布缩放和拖拽浏览
- **视图控制**：标签显示/隐藏、布局重置
- **数据导出**：SVG格式图像导出

## 🔌 API接口

### 数据接口
| 端点 | 方法 | 描述 | 参数 |
|------|------|------|------|
| `/api/graph-data` | GET | 获取网络图数据 | `sample`：采样大小 |
| `/api/stats` | GET | 获取网络统计信息 | 无 |
| `/api/node/:id` | GET | 获取特定节点详情 | `id`：节点ID |
| `/health` | GET | 服务健康检查 | 无 |

### 示例请求
```javascript
// 获取500个节点的采样数据
fetch('/api/graph-data?sample=500')
  .then(response => response.json())
  .then(data => console.log(data));

// 获取节点123的详细信息
fetch('/api/node/123')
  .then(response => response.json())
  .then(data => console.log(data));
```

## 🎨 使用指南

### 基本操作
1. **浏览网络**：使用鼠标滚轮缩放，拖拽移动视图
2. **查看节点**：点击任意节点查看详细信息
3. **高亮连接**：鼠标悬停在节点上高亮显示其连接
4. **调整采样**：使用采样控制选择不同规模的数据集

### 视图控制
- **重置布局**：点击"重置布局"按钮重新计算节点位置
- **适应视图**：点击"适应视图"自动缩放至最佳显示比例
- **冻结布局**：点击"冻结布局"停止力导向模拟，固定当前布局
- **切换标签**：显示/隐藏节点标签

### 数据探索
- 在左侧统计面板查看网络整体特征
- 在右侧信息面板查看选中节点的详细信息
- 使用不同采样规模平衡性能与细节

## ⚠️ 注意事项

### 数据准备
- 确保 `backend/data/facebook_combined.txt` 文件存在
- 如数据文件不存在，请从 [SNAP官网](https://snap.stanford.edu/data/facebook_combined.txt.gz) 下载
- 首次运行需要执行 `node download_data.js` 处理数据

### 性能优化
- 大数据集（1000+节点）建议使用采样功能
- 如遇性能问题，可减少采样节点数量
- 冻结布局可以提升交互流畅度

### 常见问题
1. **端口占用**：如3000端口被占用，会自动使用其他可用端口
2. **数据加载失败**：检查 `graph_data.json` 文件是否正常生成
3. **可视化异常**：尝试刷新页面或重置布局

## 🐛 故障排除

### 数据相关问题
```bash
# 检查数据文件是否存在
ls backend/data/facebook_combined.txt

# 重新处理数据
cd backend/data
node download_data.js
```

### 服务启动问题
```bash
# 检查端口占用
netstat -ano | findstr :3000

# 清除npm缓存
npm cache clean --force

# 重新安装依赖
rm -rf node_modules
npm install
```

### 可视化问题
- 如节点显示异常，点击"重置布局"按钮
- 如视图混乱，点击"适应视图"按钮
- 如性能较慢，减少采样节点数量

## 📈 项目扩展

### 可能的改进方向
- 添加更多网络分析算法（中心性、社区检测）
- 支持时间序列动态网络
- 添加多种布局算法
- 集成更多SNAP数据集
- 添加用户行为分析

### 开发模式
```bash
# 使用nodemon开发模式（需要安装nodemon）
npm install -g nodemon
npm run dev
```

## 👥 团队成员

- 前端开发：负责D3.js可视化和用户交互
- 后端开发：负责数据API和服务器逻辑
- 数据处理：负责SNAP数据集的处理和优化

## 📄 许可证

MIT License

---

**开始探索社交网络的奥秘吧！** 🚀

如有问题，请检查控制台错误信息或查阅本文档的故障排除部分。
