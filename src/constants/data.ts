import { NavItem } from '@/types';

//Info: The following data is used for the sidebar navigation and Cmd K bar.
export const navItems: NavItem[] = [
  {
    title: '数据看板',
    url: '/dashboard/overview',
    icon: 'dashboard',
    isActive: false,
    shortcut: ['d', 'd'],
    items: [] // Empty array as there are no child items for Dashboard
  },
  {
    title: '价格与账单',
    url: '/dashboard/billing',
    icon: 'billing',
    shortcut: ['b', 'b'],
    isActive: false,
    items: []
  },
  {
    title: '补偿任务',
    url: '/dashboard/compensation-tasks',
    icon: 'billing',
    shortcut: ['c', 't'],
    isActive: false,
    items: []
  },
  {
    title: '账号管理',
    url: '#', // Placeholder as there is no direct link for the parent
    icon: 'billing',
    isActive: true,
    items: [
      {
        title: '个人信息',
        url: '/dashboard/profile',
        icon: 'userPen',
        shortcut: ['m', 'm']
      },
      // {
      //   title: 'Login',
      //   shortcut: ['l', 'l'],
      //   url: '/',
      //   icon: 'login'
      // },
      {
        title: '用户管理',
        url: '/dashboard/users',
        icon: 'user',
        shortcut: ['u', 'u']
      }
    ]
  },
  {
    title: '系统设置',
    url: '/dashboard/settings',
    icon: 'settings',
    shortcut: ['s', 's'],
    isActive: false,
    items: [] // No child items
  }
];

export interface SaleUser {
  id: number;
  name: string;
  email: string;
  amount: string;
  image: string;
  initials: string;
}

export const recentSalesData: SaleUser[] = [
  {
    id: 1,
    name: 'Olivia Martin',
    email: 'olivia.martin@email.com',
    amount: '+$1,999.00',
    image: 'https://api.slingacademy.com/public/sample-users/1.png',
    initials: 'OM'
  },
  {
    id: 2,
    name: 'Jackson Lee',
    email: 'jackson.lee@email.com',
    amount: '+$39.00',
    image: 'https://api.slingacademy.com/public/sample-users/2.png',
    initials: 'JL'
  },
  {
    id: 3,
    name: 'Isabella Nguyen',
    email: 'isabella.nguyen@email.com',
    amount: '+$299.00',
    image: 'https://api.slingacademy.com/public/sample-users/3.png',
    initials: 'IN'
  },
  {
    id: 4,
    name: 'William Kim',
    email: 'will@email.com',
    amount: '+$99.00',
    image: 'https://api.slingacademy.com/public/sample-users/4.png',
    initials: 'WK'
  },
  {
    id: 5,
    name: 'Sofia Davis',
    email: 'sofia.davis@email.com',
    amount: '+$39.00',
    image: 'https://api.slingacademy.com/public/sample-users/5.png',
    initials: 'SD'
  }
];
