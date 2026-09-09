// mock 接口返回的菜单：key 由后端下发，前端拿到后再 t(item.title)。
// 主命令默认不扫 mock 目录（里面不是硬编码文案），但 locales 子命令要拿它当引用证据，否则 typo 会被判成死 key。
export default [{ path: '/typo', title: 'typo' }]
