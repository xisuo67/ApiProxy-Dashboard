# Docker 部署说明

## 使用方法

### 1. 构建 Docker 镜像

在项目根目录执行：

```bash
docker build -t api-proxy-dashboard:latest .
```

**如果遇到镜像拉取失败（网络问题）：**

**方法 1：配置 Docker 镜像加速器（推荐）**

编辑 Docker Desktop 设置或创建 `/etc/docker/daemon.json`：

```json
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com",
    "https://mirror.baidubce.com"
  ]
}
```

然后重启 Docker。

**方法 2：使用备用 Dockerfile**

如果 `node:20-alpine` 拉取失败，可以使用完整版 Node.js 镜像：

```bash
docker build -f Dockerfile.alternative -t api-proxy-dashboard:latest .
```

**方法 3：手动拉取镜像**

```bash
# 先手动拉取镜像
docker pull node:20-alpine

# 然后再构建
docker build -t api-proxy-dashboard:latest .
```

**方法 4：使用代理**

```bash
docker build --build-arg HTTP_PROXY=http://your-proxy:port --build-arg HTTPS_PROXY=http://your-proxy:port -t api-proxy-dashboard:latest .
```

### 2. 运行容器

```bash
docker run -d \
  --name api-proxy-app \
  --restart unless-stopped \
  -p 3000:3000 \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  -e DATABASE_URL="mysql://username:password@mysql-host:3306/database_name" \
  -e NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_xxxxx" \
  -e CLERK_SECRET_KEY="sk_live_xxxxx" \
  -e CLERK_WEBHOOK_SECRET="whsec_xxxxx" \
  -e NEXT_PUBLIC_APP_URL="https://your-domain.com" \
  api-proxy-dashboard:latest
```

### 3. 使用环境变量文件（推荐）

创建 `.env` 文件：

```bash
DATABASE_URL=mysql://username:password@mysql-host:3306/database_name
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxxxx
CLERK_SECRET_KEY=sk_live_xxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxx
NEXT_PUBLIC_APP_URL=https://your-domain.com
NODE_ENV=production
```

然后运行（包含日志配置）：

```bash
docker run -d \
  --network caddy_net \
  --name api-proxy-app \
  --restart unless-stopped \
  --env-file .env \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  api-proxy-dashboard:latest
```

**日志配置说明：**
- `--log-opt max-size=10m`: 单个日志文件最大 10MB（可选值：k, m, g）
- `--log-opt max-file=3`: 保留最多 3 个日志文件（达到 max-size 后会自动轮转）

### 4. 运行数据库迁移

```bash
docker exec -it api-proxy-app sh -c "cd /app && pnpm db:migrate:deploy"
```

**重要说明：**

- **`db:generate`**（构建时执行）：
  - 生成 Prisma Client 代码和 TypeScript 类型定义
  - **不需要数据库连接**，只需要读取 `prisma/schema.prisma` 文件
  - 必须在构建时执行，因为 Next.js 构建需要这些类型定义

- **`db:migrate:deploy`**（运行时执行）：
  - 执行数据库迁移，创建/更新数据库表结构
  - **需要数据库连接**（需要配置 `DATABASE_URL`）
  - 在容器启动后执行，因为此时才有数据库连接

## 常用命令

```bash
# 查看日志
docker logs -f api-proxy-app

# 查看最近 100 行日志
docker logs --tail 100 api-proxy-app

# 查看日志文件位置（Docker 默认日志路径）
# Linux: /var/lib/docker/containers/<container-id>/<container-id>-json.log

# 停止容器
docker stop api-proxy-app

# 启动容器
docker start api-proxy-app

# 删除容器
docker rm api-proxy-app

# 删除镜像
docker rmi api-proxy-dashboard:latest
```

## 日志配置选项

Docker 日志配置参数：

- `--log-opt max-size=10m`: 单个日志文件最大大小
  - 支持单位：`k` (KB), `m` (MB), `g` (GB)
  - 示例：`10m`, `100k`, `1g`
  
- `--log-opt max-file=3`: 保留的日志文件数量
  - 当日志文件达到 `max-size` 时，会自动创建新文件
  - 超过 `max-file` 数量的旧文件会被自动删除
  
**推荐配置：**
- 小型应用：`max-size=10m max-file=3`（约 30MB 总日志）
- 中型应用：`max-size=50m max-file=5`（约 250MB 总日志）
- 大型应用：`max-size=100m max-file=10`（约 1GB 总日志）

