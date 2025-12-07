# Clerk Webhook 配置指南

本指南将帮助你配置 Clerk Webhook，以便在用户注册、更新或删除时自动同步到本地数据库。

## 📋 前置条件

1. 已部署应用（本地开发或生产环境）
2. 应用可以通过公网访问（Clerk 需要能够访问你的 webhook 端点）
3. 已配置 Clerk API Keys（`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` 和 `CLERK_SECRET_KEY`）

## 🔧 配置步骤

### 步骤 1: 获取 Webhook URL

你的 webhook 端点地址为：
```
https://你的域名/api/webhooks/clerk
```

**本地开发环境：**
- 使用 [ngrok](https://ngrok.com/) 或类似工具创建公网隧道
- 例如：`https://abc123.ngrok.io/api/webhooks/clerk`

**生产环境：**
- 直接使用你的生产域名
- 例如：`https://api.example.com/api/webhooks/clerk`

### 步骤 2: 在 Clerk Dashboard 中创建 Webhook

1. 登录 [Clerk Dashboard](https://dashboard.clerk.com/)
2. 选择你的应用（Application）
3. 在左侧菜单中，点击 **"Webhooks"**
4. 点击 **"Add Endpoint"** 或 **"Create Endpoint"** 按钮
5. 填写以下信息：
   - **Endpoint URL**: 输入你的 webhook URL（步骤 1 中的地址）
   - **Subscriptions（订阅事件）**: 选择以下事件：
     - ✅ `user.created` - 用户创建时触发
     - ✅ `user.updated` - 用户信息更新时触发
     - ✅ `user.deleted` - 用户删除时触发
6. 点击 **"Create"** 或 **"Save"**

### 步骤 3: 获取 Webhook Signing Secret

1. 在 Webhooks 页面，找到你刚创建的 endpoint
2. 点击 endpoint 名称进入详情页
3. 在 **"Signing Secret"** 部分，点击 **"Reveal"** 或 **"Show"** 按钮
4. 复制这个 Secret（格式类似：`whsec_xxxxxxxxxxxxxxxxxxxxx`）

### 步骤 4: 配置环境变量

将获取到的 Signing Secret 添加到你的环境变量中：

**本地开发（`.env.local`）：**
```bash
CLERK_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
```

**生产环境：**
- 在部署平台（Vercel、Railway、AWS 等）的环境变量设置中添加：
  - 变量名：`CLERK_WEBHOOK_SECRET`
  - 变量值：你从 Clerk Dashboard 复制的 Secret

### 步骤 5: 测试 Webhook

#### 方法 1: 使用 Clerk Dashboard 测试

1. 在 Clerk Dashboard 的 Webhook 详情页
2. 找到 **"Test"** 或 **"Send Test Event"** 按钮
3. 选择事件类型（如 `user.created`）
4. 点击发送测试事件
5. 检查你的应用日志，确认收到并处理了 webhook

#### 方法 2: 创建测试用户

1. 在 Clerk Dashboard 中创建一个新用户
2. 检查你的数据库，确认 `users` 表中出现了新用户记录
3. 检查应用日志，确认 webhook 处理成功

## 🔍 验证配置

### 检查 Webhook 是否正常工作

1. **查看 Clerk Dashboard 的 Webhook 日志：**
   - 在 Webhook 详情页，查看 **"Recent Deliveries"** 或 **"Logs"**
   - 应该看到 `200 OK` 状态码

2. **查看应用日志：**
   - 如果 webhook 验证失败，会看到：`❌ Clerk webhook verification failed`
   - 如果处理成功，会返回 `200 OK`

3. **检查数据库：**
   - 创建新用户后，检查 `users` 表是否有对应记录
   - 更新用户信息后，检查 `users` 表是否同步更新

## ⚠️ 常见问题

### 问题 1: Webhook 返回 500 错误

**可能原因：**
- `CLERK_WEBHOOK_SECRET` 环境变量未配置或配置错误
- Secret 值不正确（复制时可能包含空格）

**解决方法：**
- 检查环境变量是否正确配置
- 重新从 Clerk Dashboard 复制 Secret
- 确保没有多余的空格或换行

### 问题 2: Webhook 返回 400 错误（Invalid signature）

**可能原因：**
- Webhook Secret 不匹配
- 请求被中间代理修改（如负载均衡器）

**解决方法：**
- 确认使用的是正确的 Signing Secret
- 检查是否有代理服务器修改了请求头

### 问题 3: 本地开发无法接收 Webhook

**原因：**
- Clerk 无法访问本地 `localhost` 地址

**解决方法：**
- 使用 ngrok 创建公网隧道：
  ```bash
  ngrok http 3000
  ```
- 将 ngrok 提供的 URL 配置到 Clerk Webhook
- 注意：每次重启 ngrok 会生成新 URL，需要更新 Clerk 配置

### 问题 4: 用户创建了但数据库没有记录

**可能原因：**
- Webhook 未配置或配置错误
- Webhook 处理失败但未报错

**解决方法：**
- 检查 Clerk Dashboard 的 Webhook 日志
- 检查应用日志中的错误信息
- 确认数据库连接正常
- 使用备用机制：用户首次访问 dashboard 时会自动同步（见 `src/app/dashboard/layout.tsx`）

## 📝 代码说明

Webhook 处理逻辑位于：`src/app/api/webhooks/clerk/route.ts`

**处理的事件：**
- `user.created`: 创建新用户记录
- `user.updated`: 更新现有用户信息（email、name、avatarUrl）
- `user.deleted`: 删除用户记录

**安全验证：**
- 使用 Svix 库验证 webhook 签名
- 确保请求来自 Clerk，防止伪造请求

## 🔄 备用同步机制

即使 Webhook 配置失败，系统也有备用机制：

- 用户首次访问 dashboard 时，会自动检查并同步用户信息
- 管理员可以手动调用 `/api/admin/users/sync` 批量同步所有用户

详见：`src/app/dashboard/layout.tsx` 和 `src/lib/user-sync.ts`




