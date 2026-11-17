import { Mark, mergeAttributes } from '@tiptap/core'
import { InputRule } from '@tiptap/core'

/**
 * 双向链接 Mark：输入 [[标题]] 自动转换为可点击的双链标签
 * 渲染为 <span class="wiki-link" data-wiki-title="标题">，样式由全局 CSS 定义
 */
export const WikiLink = Mark.create({
  name: 'wikiLink',

  inclusive: false,

  addAttributes() {
    return {
      title: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-wiki-title') || '',
        renderHTML: (attrs) => ({ 'data-wiki-title': attrs.title })
      }
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-wiki-title]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'wiki-link' }), 0]
  },

  addInputRules() {
    return [
      new InputRule({
        // 输入 [[xxx]] 结尾时触发转换
        find: /\[\[([^\[\]]+)\]\]$/,
        handler: ({ state, range, match }) => {
          const title = match[1]
          if (!title) return null
          const tr = state.tr.insertText(title, range.from, range.to)
          tr.addMark(range.from, range.from + title.length, state.schema.marks.wikiLink.create({ title }))
          return tr
        }
      })
    ]
  }
})
