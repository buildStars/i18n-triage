// 路由 meta.title 里存的是 key，运行时 t(route.meta.title) 动态取用：
// 引用采集看不到 t() 的静态实参，但字面量恰好等于 key，应算「可能通过字面量引用」而不是死 key
export const routes = [{ path: '/cancel', meta: { title: 'common.cancel' } }]
