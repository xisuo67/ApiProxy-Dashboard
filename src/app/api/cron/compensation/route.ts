import { batchProcessCompensationTasks } from '@/lib/compensation-task';
import { NextRequest, NextResponse } from 'next/server';

// 可选：简单的安全校验，避免被随意调用
function validateCronSecret(req: NextRequest) {
  const secretFromEnv = process.env.CRON_SECRET;
  if (!secretFromEnv) return true; // 未配置时不校验

  const header = req.headers.get('x-cron-secret');
  return header === secretFromEnv;
}

// 使用定时任务（如 Linux cron、node-cron 或外部定时服务）调用此接口
export async function GET(req: NextRequest) {
  try {
    if (!validateCronSecret(req)) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const result = await batchProcessCompensationTasks();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[BATCH_PROCESS_COMPENSATION_TASKS_ERROR]', error);
    return NextResponse.json({ message: '处理补偿任务失败' }, { status: 500 });
  }
}
