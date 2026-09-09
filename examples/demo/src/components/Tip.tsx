import { defineComponent } from 'vue'

/** JSX：文本节点与属性同样能识别 */
export default defineComponent({
  name: 'Tip',
  props: { count: { type: Number, default: 0 } },
  setup(props) {
    return () => (
      <div class="tip" title="提示信息">
        当前共 {props.count} 条
        <button onClick={() => alert('点击了提示')}>知道了</button>
      </div>
    )
  },
})
