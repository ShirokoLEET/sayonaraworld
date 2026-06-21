import { afterEach, describe, expect, it, vi } from 'vitest'

import { flushPromises, mount } from '@vue/test-utils'
import App from '../App.vue'

describe('App', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the Sayonara World HUD shell with blog windows', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          total: 1,
          blogs: [
            {
              title: '一次简单的Unity游戏逆向以及金手指制作',
              description: '使用Kiero2+MinHook+Imgui+UnityResolve',
              link: 'https://blog.sayonara.world/posts/%E4%B8%80%E6%AC%A1%E7%AE%80%E5%8D%95%E7%9A%84unity%E9%80%86%E5%90%91%E4%BB%A5%E5%8F%8A%E9%87%91%E6%89%8B%E6%8C%87%E5%88%B6%E4%BD%9C/',
            },
          ],
        }),
      }),
    )

    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.find('main.wired-shell').exists()).toBe(true)
    expect(wrapper.text()).toContain('SAYONARA_1.0')
    expect(wrapper.text()).not.toContain('SAYONARA_MONITOR.EXE')
    expect(wrapper.text()).not.toContain('WORLD_ALERT.DLL')
    expect(wrapper.text()).not.toContain('BLOG_SIGNAL_01.HTML')
    expect(wrapper.find('.blog-window-title-text').text()).toBe(
      '一次简单的Unity游戏逆向以及金手指制作',
    )
    expect(wrapper.find('.blog-window-extension').text()).toBe('.html')
    expect(wrapper.find('.blog-body').text()).not.toContain('一次简单的Unity游戏逆向以及金手指制作')
    expect(wrapper.find('.blog-question').text()).toContain('使用Kiero2+MinHook+Imgui+UnityResolve')
    expect(wrapper.find('a.blog-window').exists()).toBe(false)
    expect(wrapper.find('[data-blog-action="open"]').text()).toBe('Yes(Y)')
    expect(wrapper.find('[data-blog-action="close"]').text()).toBe('No(N)')
  })
})
