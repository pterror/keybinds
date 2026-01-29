import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'keybinds',
  description: 'Declarative, contextual keybindings for the web',
  base: '/keybinds/',

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/' },
      { text: 'Reference', link: '/reference/' },
    ],

    sidebar: {
      '/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting Started', link: '/guide/' },
            { text: 'Commands', link: '/guide/commands' },
            { text: 'Context', link: '/guide/context' },
            { text: 'Components', link: '/guide/components' },
            { text: 'Styling', link: '/guide/styling' },
          ]
        },
        {
          text: 'Reference',
          items: [
            { text: 'API', link: '/reference/' },
            { text: 'Components', link: '/reference/components' },
          ]
        },
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/pterror/keybinds' }
    ],

    search: {
      provider: 'local'
    },
  },
})
