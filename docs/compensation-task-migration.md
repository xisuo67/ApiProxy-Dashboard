# 补偿任务数据库迁移说明

## 数据库表结构

如果使用方案 C（混合方案），需要添加 `CompensationTask` 表。

### Prisma Schema 更新

在 `prisma/schema.prisma` 中添加：

```prisma
model CompensationTask {
  id            BigInt   @id @default(autoincrement())
  userId        BigInt   // 用户 ID
  user          User     @relation("UserCompensationTasks", fields: [userId], references: [id])
  userPricingId BigInt   // UserPricing ID
  cost          Decimal  @db.Decimal(12, 4) // 需要扣除的费用
  status        String   @default("pending") // pending, processing, completed, failed
  retryCount    Int      @default(0) // 重试次数
  maxRetries    Int      @default(3) // 最大重试次数
  errorMessage  String?  @db.Text // 错误信息
  // 日志信息（用于对账）
  userClerkId    String   // 用户 Clerk ID
  serviceProvider String  // 服务商名称
  requestApi     String   // 请求接口
  requestBody    String   @db.Text // 请求参数
  responseBody   String   @db.Text // 响应内容
  completedAt   DateTime? // 完成时间
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([status, createdAt]) // 按状态和时间查询
  @@index([userId]) // 按用户查询
  @@map("compensation_tasks")
}

// 在 User 模型中添加关系
model User {
  // ... existing fields ...
  compensationTasks CompensationTask[] @relation("UserCompensationTasks")
}
```

### 执行迁移

```bash
# 生成迁移文件
pnpm db:migrate

# 或直接推送到数据库（开发环境）
pnpm db:push
```

## 后台任务处理器

创建 `src/app/api/cron/compensation/route.ts` 用于定期处理补偿任务：

```typescript
import { batchProcessCompensationTasks } from '@/lib/compensation-task';
import { NextRequest, NextResponse } from 'next/server';

// 使用 cron job 或定时任务调用此接口
export async function GET(req: NextRequest) {
  try {
    const result = await batchProcessCompensationTasks();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[BATCH_PROCESS_COMPENSATION_TASKS_ERROR]', error);
    return NextResponse.json(
      { message: '处理补偿任务失败' },
      { status: 500 }
    );
  }
}
```

### 配置定时任务

可以使用以下方式配置定时任务：

1. **使用 Vercel Cron Jobs**（如果部署在 Vercel）
2. **使用外部 cron 服务**（如 EasyCron）定期调用 `/api/cron/compensation`
3. **使用 Node.js 定时任务库**（如 node-cron）

建议每 5-10 分钟执行一次。

