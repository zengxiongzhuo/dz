# 德州扑克在线对战 (Texas Hold'em Poker)

多人在线德州扑克游戏，支持创建房间、邀请好友实时对战。

## 功能特性

- 创建/加入房间，6位房间号分享给好友
- 支持 2-10 人同时在线对战
- 完整德州扑克规则：翻牌、转牌、河牌、摊牌
- 下注、跟注、加注、全押、弃牌
- 断线重连（30秒宽限期）
- 自定义昵称和头像
- 筹码借贷机制

## 技术栈

| 层      | 技术                          |
|---------|-------------------------------|
| 前端    | React 18 + Vite + Socket.IO   |
| 后端    | Node.js + Express + Socket.IO |
| 牌型    | pokersolver                   |

## 本地开发

```bash
# 安装依赖
npm install
cd server && npm install
cd ../client && npm install

# 启动开发模式（前后端同时启动）
cd .. && npm run dev
```

前端: http://localhost:5173
后端: http://localhost:3001

## Docker 部署

```bash
# 构建并启动
docker compose up -d --build

# 查看日志
docker logs -f dz-poker
```

服务默认运行在 **3001** 端口，通过 `PORT` 环境变量可修改。

## 环境变量

| 变量  | 默认值 | 说明         |
|-------|--------|--------------|
| PORT  | 3001   | 服务监听端口 |

## 项目结构

```
dz/
├── client/                 # 前端 (React + Vite)
│   ├── src/
│   │   ├── components/     # UI 组件（牌桌、手牌、操作面板等）
│   │   ├── pages/          # 页面（大厅、牌局）
│   │   ├── hooks/          # Socket.IO Hook
│   │   ├── data/           # 头像数据
│   │   └── styles/         # 样式
│   └── vite.config.js
├── server/                 # 后端 (Node.js + Socket.IO)
│   ├── game/               # 游戏逻辑（房间、牌组、牌型评估）
│   ├── socket/             # Socket.IO 事件处理
│   └── index.js            # 入口
├── Dockerfile
└── docker-compose.yml
```

## 游戏流程

1. 选择头像和昵称 → 进入大厅
2. 创建房间（设置初始筹码）或输入房间号加入
3. 房主点击「开始游戏」
4. 系统自动发牌、轮流下注
5. 每手结束后自动开始下一手
6. 房主可随时「结束对局」查看战绩
