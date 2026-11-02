<script lang="ts">
import { defineComponent, h } from 'vue'
import { parseGuideHtml, renderGuideHtml } from './guide-html'

export default defineComponent({
  name: 'GuideRichText',
  props: {
    html: { type: String, required: true }
  },
  setup(props) {
    return () => h('span', renderGuideHtml(parseGuideHtml(props.html)))
  }
})
</script>
