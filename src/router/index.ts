import { reactive, watch } from 'vue'
import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router'
import { i18n } from '../i18n'

export const sectionLinks = reactive({ analytics: '/', sessions: '/sessions', limits: '/limits' })
function screen(route: RouteLocationNormalized) {
  return route.name === 'session' || route.name === 'run' ? `session:${String(route.params.sid)}` : String(route.name)
}
export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'analytics', component: () => import('../views/AnalyticsView.vue') },
    { path: '/sessions', name: 'sessions', component: () => import('../views/SessionsView.vue') },
    { path: '/sessions/:sid', name: 'session', props: true, component: () => import('../views/SessionView.vue') },
    { path: '/sessions/:sid/runs/:rid', name: 'run', props: true, component: () => import('../views/SessionView.vue') },
    { path: '/limits', name: 'limits', component: () => import('../views/LimitsView.vue') },
    { path: '/:pathMatch(.*)*', name: 'missing', component: () => import('../views/NotFoundView.vue') },
  ],
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    // Filters, pages and run selection keep the reader's place; a new screen starts at the top.
    return screen(to) === screen(from) ? false : { top: 0 }
  },
})
function title() {
  const route = router.currentRoute.value
  const t = i18n.global.t
  const parent = route.name === 'session' || route.name === 'run' ? t('nav.sessions') : t(`nav.${String(route.name)}`)
  const details = route.params.rid ? [String(route.params.rid).slice(0, 8), String(route.params.sid).slice(0, 8)] : route.params.sid ? [String(route.params.sid).slice(0, 8)] : []
  document.title = [...details, parent, t('app.name')].join(' / ')
  document.documentElement.lang = i18n.global.locale.value
}
router.afterEach((to) => {
  if (to.name === 'analytics' || to.name === 'sessions' || to.name === 'limits') sectionLinks[to.name] = to.fullPath
  title()
})
watch(i18n.global.locale, title)
