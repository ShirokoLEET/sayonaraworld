<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import * as THREE from 'three'
import { feature } from 'topojson-client'
import type { GeometryObject, Topology } from 'topojson-specification'
import landTopology from 'world-atlas/land-110m.json'

type LocationKind = 'real' | 'ghost'
type BootPhase = 'win98' | 'fade'
type BlogFetchState = 'loading' | 'ready' | 'error'

interface WiredLocation {
  name: string
  lat: number
  lon: number
  type: LocationKind
}

interface DebugLine {
  id: number
  text: string
}

interface FloodPopup {
  id: number
  left: number
  top: number
  rotation: number
  code: string
}

interface GlobeLabel {
  element: HTMLDivElement
  position: THREE.Vector3
}

interface DataPacket {
  mesh: THREE.Mesh
  curve: THREE.CatmullRomCurve3
  progress: number
  speed: number
}

interface ActiveArc {
  line: THREE.Line
  startTime: number
  duration: number
  totalPoints: number
}

type GeoPosition = [number, number] | [number, number, number]

interface GeoPolygon {
  type: 'Polygon'
  coordinates: GeoPosition[][]
}

interface GeoMultiPolygon {
  type: 'MultiPolygon'
  coordinates: GeoPosition[][][]
}

interface GeoFeature {
  geometry: GeoPolygon | GeoMultiPolygon | null
}

interface GeoFeatureCollection {
  type: 'FeatureCollection'
  features: GeoFeature[]
}

interface LandTopology {
  objects: {
    land: GeometryObject
  }
}

interface BlogEntry {
  title: string
  description: string
  link: string
}

interface BlogFeed {
  total: number
  blogs: BlogEntry[]
}

interface BlogWindowLayout {
  top: number
  left: number
  width: number
  rotate: number
}

interface BlogWindowState {
  link: string
  left: number
  top: number
  width: number
  rotate: number
  visible: boolean
  zIndex: number
}

interface BlogDragState {
  link: string
  pointerId: number
  startX: number
  startY: number
  left: number
  top: number
}

const BLOGS_ENDPOINT = '/api/blogs.json'

const locations: readonly WiredLocation[] = [
  { name: 'TOKYO', lat: 35.6762, lon: 139.6503, type: 'real' },
  { name: 'OSAKA', lat: 34.6937, lon: 135.5023, type: 'real' },
  { name: 'SHANGHAI', lat: 31.2304, lon: 121.4737, type: 'real' },
  { name: 'HONG KONG', lat: 22.3193, lon: 114.1694, type: 'real' },
  { name: 'SINGAPORE', lat: 1.3521, lon: 103.8198, type: 'real' },
  { name: 'SEOUL', lat: 37.5665, lon: 126.978, type: 'real' },
  { name: 'MUMBAI', lat: 19.076, lon: 72.8777, type: 'real' },
  { name: 'NEW YORK', lat: 40.7128, lon: -74.006, type: 'real' },
  { name: 'SAN FRANCISCO', lat: 37.7749, lon: -122.4194, type: 'real' },
  { name: 'SEATTLE', lat: 47.6062, lon: -122.3321, type: 'real' },
  { name: 'TORONTO', lat: 43.65107, lon: -79.347015, type: 'real' },
  { name: 'LONDON', lat: 51.5074, lon: -0.1278, type: 'real' },
  { name: 'BERLIN', lat: 52.52, lon: 13.405, type: 'real' },
  { name: 'PARIS', lat: 48.8566, lon: 2.3522, type: 'real' },
  { name: 'MOSCOW', lat: 55.7558, lon: 37.6173, type: 'real' },
  { name: 'REYKJAVIK', lat: 64.1466, lon: -21.9426, type: 'real' },
  { name: 'SYDNEY', lat: -33.8688, lon: 151.2093, type: 'real' },
  { name: 'SAO PAULO', lat: -23.5505, lon: -46.6333, type: 'real' },
  { name: 'CAPE TOWN', lat: -33.9249, lon: 18.4241, type: 'real' },
  { name: 'NODE_ZERO', lat: 0, lon: 0, type: 'ghost' },
  { name: 'LAYER:07', lat: 45, lon: 160, type: 'ghost' },
  { name: 'DEEP_WEB', lat: -70, lon: 40, type: 'ghost' },
  { name: 'SAT_UPLINK', lat: 25, lon: -40, type: 'ghost' },
  { name: 'VOID_REGION', lat: -30, lon: -120, type: 'ghost' },
]

const bootMessages = [
  'Initializing Sayonara World shell...',
  'Loading goodbye route...',
  'Checking next-world display...',
  'Mounting last signal interface...',
  'Load complete.',
] as const

const chatMessages = [
  { user: 'Sayonara', text: 'The old world is closing.' },
  { user: 'World', text: 'Goodbye protocol initiated.' },
  { user: 'Signal', text: 'I still hear the next layer.' },
  { user: 'Echo', text: 'Every farewell leaves a route.' },
  { user: 'Gate', text: 'Open the next world.' },
  { user: 'System', text: 'Sayonara node 442 sync complete.' },
  { user: 'Archive', text: 'The last message remains.' },
  { user: 'Observer', text: 'Tracing goodbye signal source...' },
] as const

const globeHost = ref<HTMLDivElement | null>(null)
const noiseCanvas = ref<HTMLCanvasElement | null>(null)

const bootVisible = ref(true)
const bootPhase = ref<BootPhase>('win98')
const bootProgress = ref(0)
const bootStatus = ref<string>(bootMessages[0])
const lightMode = ref(false)
const audioVisible = ref(false)
const visorVisible = ref(false)
const chatVisible = ref(false)
const debugVisible = ref(false)
const deusWarningVisible = ref(false)
const deusOverlayVisible = ref(false)
const isFlooding = ref(false)

const coords = ref('X:000 Y:000')
const hudTime = ref('00:00:00:00')
const uptime = ref('000.00s')
const curveIntensity = ref(50)
const disconnectClicks = ref(0)
const disconnectText = ref('[ SAYONARA ]')
const disconnectStyle = ref<Record<string, string>>({})
const debugLines = ref<DebugLine[]>([])
const floodPopups = ref<FloodPopup[]>([])
const blogs = ref<BlogEntry[]>([])
const blogTotal = ref(0)
const blogFetchState = ref<BlogFetchState>('loading')
const blogFetchMessage = ref('BLOG_FEED: LOADING')
const blogWindows = ref<BlogWindowState[]>([])

let nextId = 1
let startTime = Date.now()
let bootStopped = false
let hudTimer: number | undefined
let chatTimer: number | undefined
let floodTimer: number | undefined
let noiseFrame = 0
let globeFrame = 0
let nextBlogZ = 10
let activeBlogDrag: BlogDragState | undefined
let disposeGlobe: (() => void) | undefined
let disposeNoise: (() => void) | undefined

const defaultBlogWindowLayout: BlogWindowLayout = {
  top: 21,
  left: 34,
  width: 350,
  rotate: -1.2,
}

const blogWindowLayouts: readonly BlogWindowLayout[] = [
  defaultBlogWindowLayout,
  { top: 22, left: 61, width: 320, rotate: 2 },
  { top: 50, left: 36, width: 380, rotate: 1.3 },
  { top: 49, left: 64, width: 340, rotate: -2.4 },
]

const shellStyle = computed(() => {
  const percent = curveIntensity.value / 100

  return {
    '--curve-angle': `${percent * 35}deg`,
    '--curve-spacing': `${percent * 40}px`,
    '--screen-curve-rad': `${percent * 60}px`,
    '--ui-scale': `${1 - percent * 0.08}`,
    '--vignette-opacity': `${percent * 0.9}`,
  }
})

const blogFeedLine = computed(() => {
  if (blogFetchState.value === 'ready') {
    return `BLOGS: ${blogs.value.length}/${blogTotal.value}`
  }

  if (blogFetchState.value === 'error') {
    return 'BLOGS: OFFLINE'
  }

  return 'BLOGS: LOADING'
})

const blogFeedStatusClass = computed(() => ({
  'text-green': blogFetchState.value === 'ready',
  'text-red': blogFetchState.value === 'error',
  'text-cyan': blogFetchState.value === 'loading',
}))

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function flashConsole(text: string) {
  debugLines.value.unshift({ id: nextId++, text })
  debugLines.value = debugLines.value.slice(0, 6)
}

async function runBootSequence() {
  bootPhase.value = 'win98'
  bootProgress.value = 0
  bootStatus.value = bootMessages[0]

  const stages = [
    { progress: 18, status: bootMessages[0] },
    { progress: 42, status: bootMessages[1] },
    { progress: 67, status: bootMessages[2] },
    { progress: 88, status: bootMessages[3] },
    { progress: 100, status: bootMessages[4] },
  ]

  for (const stage of stages) {
    bootStatus.value = stage.status

    while (bootProgress.value < stage.progress) {
      if (bootStopped) return

      bootProgress.value = Math.min(stage.progress, bootProgress.value + 4)
      await wait(28)
    }

    await wait(115)
  }

  if (bootStopped) return
  await wait(170)
  bootPhase.value = 'fade'

  await wait(850)
  if (bootStopped) return
  bootVisible.value = false
}

function trackPointer(event: MouseEvent) {
  coords.value = `X:${event.clientX.toString().padStart(3, '0')} Y:${event.clientY
    .toString()
    .padStart(3, '0')}`
}

function updateHudClock() {
  const now = new Date()
  hudTime.value =
    now.toLocaleTimeString('en-GB', { hour12: false }) +
    ':' +
    Math.floor(now.getMilliseconds() / 10)
      .toString()
      .padStart(2, '0')
  uptime.value = `${((Date.now() - startTime) / 1000).toFixed(2)}s`
}

function toggleDebugConsole() {
  debugVisible.value = !debugVisible.value

  if (debugVisible.value) {
    flashConsole('DEBUG_CONSOLE: OPEN')
  }
}

function openChat() {
  chatVisible.value = true
  flashConsole('SAYONARA CHANNEL ESTABLISHED...')

  if (chatTimer !== undefined) {
    window.clearInterval(chatTimer)
  }

  chatTimer = window.setInterval(() => {
    const message = chatMessages[Math.floor(Math.random() * chatMessages.length)] ?? {
      user: 'System',
      text: 'Node 442 sync complete.',
    }
    flashConsole(`[${message.user}] ${message.text}`)
  }, 3500)
}

function closeChat() {
  chatVisible.value = false

  if (chatTimer !== undefined) {
    window.clearInterval(chatTimer)
    chatTimer = undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isBlogEntry(value: unknown): value is BlogEntry {
  if (!isRecord(value)) return false

  return (
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    typeof value.link === 'string'
  )
}

function parseBlogFeed(value: unknown): BlogFeed | undefined {
  if (!isRecord(value)) return undefined
  if (typeof value.total !== 'number') return undefined
  if (!Array.isArray(value.blogs)) return undefined

  return {
    total: value.total,
    blogs: value.blogs.filter(isBlogEntry),
  }
}

function blogWindowStyle(index: number) {
  const layout = blogWindowLayouts[index % blogWindowLayouts.length] ?? defaultBlogWindowLayout
  const state = blogWindows.value[index]

  if (state) {
    return {
      left: `${state.left}px`,
      top: `${state.top}px`,
      width: `${state.width}px`,
      rotate: `${state.rotate}deg`,
      zIndex: state.zIndex,
    }
  }

  return {
    left: `${layout.left}%`,
    top: `${layout.top}%`,
    width: `${layout.width}px`,
    rotate: `${layout.rotate}deg`,
    zIndex: 6 + index,
  }
}

function createBlogWindowStates(entries: BlogEntry[]) {
  const viewportWidth = window.innerWidth || 1280
  const viewportHeight = window.innerHeight || 720
  const isMobile = viewportWidth <= 760

  nextBlogZ = 10 + entries.length
  blogWindows.value = entries.map((entry, index) => {
    const layout = blogWindowLayouts[index % blogWindowLayouts.length] ?? defaultBlogWindowLayout
    const row = Math.floor(index / blogWindowLayouts.length)
    const width = isMobile
      ? Math.min(335, viewportWidth - 24)
      : Math.min(layout.width, viewportWidth * 0.34)
    const left = isMobile ? (viewportWidth - width) / 2 : (viewportWidth * layout.left) / 100
    const top = isMobile ? 144 + index * 112 : (viewportHeight * layout.top) / 100 + row * 34

    return {
      link: entry.link,
      left,
      top,
      width,
      rotate: isMobile ? 0 : layout.rotate,
      visible: true,
      zIndex: 10 + index,
    }
  })
}

function getBlogWindowState(blog: BlogEntry) {
  return blogWindows.value.find((windowState) => windowState.link === blog.link)
}

function isBlogWindowVisible(blog: BlogEntry) {
  return getBlogWindowState(blog)?.visible ?? false
}

function bringBlogWindowToFront(blog: BlogEntry) {
  const state = getBlogWindowState(blog)
  if (!state) return

  nextBlogZ += 1
  state.zIndex = nextBlogZ
}

function openBlog(blog: BlogEntry) {
  flashConsole(`BLOG_JUMP: ${blog.title}`)
  window.location.assign(blog.link)
}

function closeBlogWindow(blog: BlogEntry) {
  const state = getBlogWindowState(blog)
  if (!state) return

  state.visible = false
  flashConsole(`BLOG_WINDOW_CLOSED: ${blog.title}`)
}

function startBlogWindowDrag(event: PointerEvent, blog: BlogEntry) {
  const state = getBlogWindowState(blog)
  if (!state) return

  bringBlogWindowToFront(blog)
  activeBlogDrag = {
    link: blog.link,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    left: state.left,
    top: state.top,
  }

  const target = event.currentTarget
  if (target instanceof HTMLElement) {
    target.setPointerCapture(event.pointerId)
  }

  event.preventDefault()
}

function moveBlogWindow(event: PointerEvent, blog: BlogEntry) {
  if (!activeBlogDrag || activeBlogDrag.link !== blog.link) return

  const state = getBlogWindowState(blog)
  if (!state) return

  const element = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined
  const maxLeft = Math.max(0, window.innerWidth - state.width)
  const maxTop = Math.max(0, window.innerHeight - (element?.offsetHeight ?? 132))

  state.left = Math.min(
    Math.max(0, activeBlogDrag.left + event.clientX - activeBlogDrag.startX),
    maxLeft,
  )
  state.top = Math.min(
    Math.max(0, activeBlogDrag.top + event.clientY - activeBlogDrag.startY),
    maxTop,
  )
}

function stopBlogWindowDrag(event: PointerEvent, blog: BlogEntry) {
  if (!activeBlogDrag || activeBlogDrag.link !== blog.link) return

  const target = event.currentTarget
  if (target instanceof HTMLElement && target.hasPointerCapture(activeBlogDrag.pointerId)) {
    target.releasePointerCapture(activeBlogDrag.pointerId)
  }

  activeBlogDrag = undefined
}

async function loadBlogs() {
  blogFetchState.value = 'loading'
  blogFetchMessage.value = 'BLOG_FEED: LOADING'

  try {
    const response = await fetch(BLOGS_ENDPOINT, {
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP_${response.status}`)
    }

    const parsed = parseBlogFeed(await response.json())

    if (!parsed || parsed.blogs.length === 0) {
      throw new Error('BLOG_FEED_EMPTY')
    }

    blogTotal.value = parsed.total
    blogs.value = parsed.blogs
    createBlogWindowStates(parsed.blogs)
    blogFetchState.value = 'ready'
    blogFetchMessage.value = `BLOG_FEED: ${parsed.blogs.length}/${parsed.total} SIGNALS`
    flashConsole(blogFetchMessage.value)
  } catch (error) {
    blogFetchState.value = 'error'
    blogFetchMessage.value =
      error instanceof Error ? `BLOG_FEED_ERROR: ${error.message}` : 'BLOG_FEED_ERROR'
    flashConsole(blogFetchMessage.value)
  }
}

function triggerFlood() {
  if (isFlooding.value) return

  isFlooding.value = true
  floodPopups.value = []
  flashConsole('⚠ CRITICAL: WORLD FLOOD')

  let count = 0
  floodTimer = window.setInterval(() => {
    count += 1
    floodPopups.value.push({
      id: nextId++,
      left: Math.random() * 76 + 4,
      top: Math.random() * 72 + 8,
      rotation: Math.random() * 30 - 15,
      code: `0x${Math.floor(Math.random() * 16777215)
        .toString(16)
        .toUpperCase()
        .padStart(6, '0')}`,
    })

    if (count >= 12 && floodTimer !== undefined) {
      window.clearInterval(floodTimer)
      floodTimer = undefined

      window.setTimeout(() => {
        floodPopups.value = []
        isFlooding.value = false
        flashConsole('GOODBYE FLOOD CONTAINED. STABILIZING...')
      }, 1600)
    }
  }, 120)
}

function reloadBlogs() {
  flashConsole('BLOG_FEED: RELOAD')
  void loadBlogs()
}

function openAudioPlayer() {
  audioVisible.value = true
  flashConsole('SAYONARA MIX LOADED')
}

function openVisorSettings() {
  visorVisible.value = true
  flashConsole('WORLD HORIZON SETTINGS OPENED')
}

function toggleLightMode() {
  lightMode.value = !lightMode.value
  flashConsole(lightMode.value ? 'SAYONARA LIGHT OPENED' : 'SAYONARA DARK RESTORED')
}

function triggerDeus() {
  deusWarningVisible.value = true
  flashConsole('SAYONARA PROTOCOL INITIATED')
}

function closeDeusWarning() {
  deusWarningVisible.value = false
  flashConsole('SAYONARA PROTOCOL ABORTED')
}

function confirmDeus() {
  deusWarningVisible.value = false
  deusOverlayVisible.value = true
  flashConsole('SAYONARA WORLD: OMNIPRESENCE DETECTED')
}

function endDeusMode() {
  deusOverlayVisible.value = false
  flashConsole('SAYONARA LAYER DISENGAGED. WORLD COMPROMISED.')
}

function handleDisconnect() {
  disconnectClicks.value += 1

  if (disconnectClicks.value === 1) {
    disconnectText.value = '[ GOODBYE DELAYED ]'
    disconnectStyle.value = { transform: 'translate(32px, -50px)' }
    flashConsole('SAYONARA DENIED: ERROR 403')
    return
  }

  if (disconnectClicks.value === 2) {
    disconnectText.value = '[ WORLD STILL HERE ]'
    disconnectStyle.value = { transform: 'translate(-64px, -96px) rotate(5deg)' }
    flashConsole('GOODBYE DENIED: WORLD LOCKED')
    return
  }

  if (disconnectClicks.value === 3) {
    disconnectText.value = 'NEXT WORLD'
    disconnectStyle.value = {
      transform: 'scale(1.5)',
      background: '#d6a36d',
      color: '#17100d',
      borderColor: '#17100d',
    }
    flashConsole('GOODBYE ROUTE SEALED')
    return
  }

  disconnectClicks.value = 0
  disconnectText.value = '[ SAYONARA ]'
  disconnectStyle.value = {}
  flashConsole('SAYONARA SYSTEM STABILIZED')
}

function latLongToVector3(lat: number, lon: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)

  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  )
}

function projectLandPoint(position: GeoPosition, width: number, height: number) {
  const [lon, lat] = position

  return {
    x: ((lon + 180) / 360) * width,
    y: ((90 - lat) / 180) * height,
  }
}

function drawLandRing(
  context: CanvasRenderingContext2D,
  ring: GeoPosition[],
  width: number,
  height: number,
) {
  if (ring.length < 3) return

  const first = projectLandPoint(ring[0] as GeoPosition, width, height)
  context.moveTo(first.x, first.y)

  for (const position of ring.slice(1)) {
    const point = projectLandPoint(position, width, height)
    context.lineTo(point.x, point.y)
  }

  context.closePath()
}

function createLandTexture() {
  const canvas = document.createElement('canvas')
  const width = 2048
  const height = 1024
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) return undefined

  const topology = landTopology as unknown as Topology
  const { land: landObject } = (landTopology as unknown as LandTopology).objects
  const land = feature(topology, landObject) as unknown as GeoFeatureCollection

  context.clearRect(0, 0, width, height)
  context.fillStyle = 'rgba(218, 218, 218, 0.78)'
  context.strokeStyle = 'rgba(255, 255, 255, 0.45)'
  context.lineWidth = 1.4
  context.shadowColor = 'rgba(255, 255, 255, 0.18)'
  context.shadowBlur = 2
  context.beginPath()

  for (const item of land.features) {
    if (!item.geometry) continue

    if (item.geometry.type === 'Polygon') {
      for (const ring of item.geometry.coordinates) {
        drawLandRing(context, ring, width, height)
      }
    }

    if (item.geometry.type === 'MultiPolygon') {
      for (const polygon of item.geometry.coordinates) {
        for (const ring of polygon) {
          drawLandRing(context, ring, width, height)
        }
      }
    }
  }

  context.fill('evenodd')
  context.stroke()

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.needsUpdate = true

  return texture
}

function setupNoiseCanvas() {
  if (typeof window.CanvasRenderingContext2D === 'undefined') return

  const canvas = noiseCanvas.value
  const context = canvas?.getContext('2d')

  if (!canvas || !context) return

  let stopped = false
  const pixelSize = 3

  const resize = () => {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
  }

  const render = () => {
    if (stopped) return

    noiseFrame = window.requestAnimationFrame(render)

    if (noiseFrame % 3 !== 0) return

    const width = Math.ceil(canvas.width / pixelSize)
    const height = Math.ceil(canvas.height / pixelSize)
    const image = context.createImageData(width, height)

    for (let index = 0; index < image.data.length; index += 4) {
      const value = Math.random() * 255
      image.data[index] = value
      image.data[index + 1] = value
      image.data[index + 2] = value
      image.data[index + 3] = 28
    }

    const scratch = document.createElement('canvas')
    scratch.width = width
    scratch.height = height
    const scratchContext = scratch.getContext('2d')
    if (!scratchContext) return

    scratchContext.putImageData(image, 0, 0)
    context.imageSmoothingEnabled = false
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(scratch, 0, 0, canvas.width, canvas.height)
  }

  resize()
  window.addEventListener('resize', resize)
  render()

  disposeNoise = () => {
    stopped = true
    window.removeEventListener('resize', resize)
    window.cancelAnimationFrame(noiseFrame)
  }
}

function setupGlobe() {
  const host = globeHost.value

  if (!host) return
  if (typeof window.WebGLRenderingContext === 'undefined') {
    host.classList.add('globe-unavailable')
    return
  }

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('webgl', { alpha: true, antialias: true })

  if (!context) {
    host.classList.add('globe-unavailable')
    return
  }

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000)
  const renderer = new THREE.WebGLRenderer({
    canvas,
    context,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  })

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0)
  renderer.domElement.className = 'wired-globe-canvas'
  host.appendChild(renderer.domElement)

  camera.position.z = 22
  camera.position.y = 4
  camera.lookAt(0, 0, 0)

  const globeGroup = new THREE.Group()
  globeGroup.rotation.x = 0.16
  globeGroup.rotation.y = -0.48
  scene.add(globeGroup)

  const radius = 8
  const globeGeometry = new THREE.IcosahedronGeometry(radius, 12)
  const wireframeMaterial = new THREE.LineBasicMaterial({
    color: 0x5b3a27,
    transparent: true,
    opacity: 0.38,
  })
  const wireframe = new THREE.LineSegments(
    new THREE.WireframeGeometry(globeGeometry),
    wireframeMaterial,
  )
  wireframe.renderOrder = 3
  globeGroup.add(wireframe)

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(radius - 0.1, 5),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.88 }),
  )
  core.renderOrder = 0
  globeGroup.add(core)

  const landTexture = createLandTexture()
  const landGeometry = new THREE.SphereGeometry(radius + 0.03, 128, 64)
  const landMaterial = new THREE.MeshBasicMaterial({
    map: landTexture,
    color: 0xffffff,
    transparent: true,
    opacity: landTexture ? 0.42 : 0,
    depthWrite: false,
  })
  const landMesh = new THREE.Mesh(landGeometry, landMaterial)
  landMesh.renderOrder = 1
  globeGroup.add(landMesh)

  const atmosphere = new THREE.Mesh(
    new THREE.IcosahedronGeometry(radius + 0.25, 5),
    new THREE.MeshBasicMaterial({
      color: 0x5b3a27,
      transparent: true,
      opacity: 0.16,
      wireframe: true,
    }),
  )
  atmosphere.renderOrder = 2
  globeGroup.add(atmosphere)

  const realDotMaterial = new THREE.MeshBasicMaterial({
    color: 0xd6a36d,
    transparent: true,
    opacity: 0.72,
  })
  const ghostDotMaterial = new THREE.MeshBasicMaterial({
    color: 0xb77a45,
    transparent: true,
    opacity: 0.85,
  })
  const packetMaterial = new THREE.MeshBasicMaterial({ color: 0xe8ba78 })
  const arcMaterial = new THREE.LineBasicMaterial({
    color: 0xe0c39b,
    transparent: true,
    opacity: 0.55,
  })

  const labels: GlobeLabel[] = []
  const locationVectors: THREE.Vector3[] = []
  const dots: THREE.Mesh[] = []

  for (const location of locations) {
    const position = latLongToVector3(location.lat, location.lon, radius)
    locationVectors.push(position)

    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(location.type === 'ghost' ? 0.13 : 0.1, 8, 8),
      location.type === 'ghost' ? ghostDotMaterial : realDotMaterial,
    )
    dot.position.copy(position)
    dot.renderOrder = 4
    globeGroup.add(dot)
    dots.push(dot)

    const label = document.createElement('div')
    label.className =
      location.type === 'ghost' ? 'globe-label globe-label-ghost' : 'globe-label globe-label-city'
    label.textContent = location.name
    host.appendChild(label)
    labels.push({ element: label, position: position.clone().multiplyScalar(1.08) })
  }

  const arcsGroup = new THREE.Group()
  globeGroup.add(arcsGroup)

  const activeArcs: ActiveArc[] = []
  const dataPackets: DataPacket[] = []
  const packetGeometry = new THREE.SphereGeometry(0.08, 4, 4)

  const createArc = (start: THREE.Vector3, end: THREE.Vector3) => {
    const mid = start
      .clone()
      .add(end)
      .normalize()
      .multiplyScalar(radius + 2 + Math.random() * 1.5)
    const curve = new THREE.CatmullRomCurve3([start.clone(), mid, end.clone()])
    const points = curve.getPoints(30)
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    geometry.setDrawRange(0, 0)

    const line = new THREE.Line(geometry, arcMaterial.clone())
    line.renderOrder = 5
    arcsGroup.add(line)
    activeArcs.push({
      line,
      startTime: Date.now(),
      duration: 4000 + Math.random() * 3000,
      totalPoints: points.length,
    })

    const packet = new THREE.Mesh(packetGeometry.clone(), packetMaterial.clone())
    packet.renderOrder = 6
    globeGroup.add(packet)
    dataPackets.push({
      mesh: packet,
      curve,
      progress: 0,
      speed: 0.005 + Math.random() * 0.005,
    })
  }

  const spawnArc = () => {
    if (activeArcs.length >= 60) return

    const startIndex = Math.floor(Math.random() * locationVectors.length)
    let endIndex = Math.floor(Math.random() * locationVectors.length)

    while (startIndex === endIndex) {
      endIndex = Math.floor(Math.random() * locationVectors.length)
    }

    const start = locationVectors[startIndex]
    const end = locationVectors[endIndex]

    if (!start || !end) return
    if (start.distanceTo(end) < 2 && Math.random() > 0.2) return

    createArc(start, end)
  }

  const arcTimer = window.setInterval(spawnArc, 120)
  let isDragging = false
  let lastX = 0
  let lastY = 0

  const handlePointerDown = (event: PointerEvent) => {
    isDragging = true
    lastX = event.clientX
    lastY = event.clientY
    renderer.domElement.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent) => {
    if (!isDragging) return

    const deltaX = event.clientX - lastX
    const deltaY = event.clientY - lastY
    lastX = event.clientX
    lastY = event.clientY

    globeGroup.rotation.y += deltaX * 0.004
    globeGroup.rotation.x = Math.max(-1.1, Math.min(1.1, globeGroup.rotation.x + deltaY * 0.003))
  }

  const handlePointerUp = (event: PointerEvent) => {
    isDragging = false

    if (renderer.domElement.hasPointerCapture(event.pointerId)) {
      renderer.domElement.releasePointerCapture(event.pointerId)
    }
  }

  renderer.domElement.addEventListener('pointerdown', handlePointerDown)
  renderer.domElement.addEventListener('pointermove', handlePointerMove)
  renderer.domElement.addEventListener('pointerup', handlePointerUp)
  renderer.domElement.addEventListener('pointercancel', handlePointerUp)

  const resize = () => {
    const width = host.clientWidth || window.innerWidth
    const height = host.clientHeight || window.innerHeight

    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
  }

  const renderLabels = () => {
    const width = host.clientWidth || window.innerWidth
    const height = host.clientHeight || window.innerHeight

    globeGroup.updateMatrixWorld()

    for (const label of labels) {
      const projected = label.position.clone().applyMatrix4(globeGroup.matrixWorld).project(camera)
      const x = (projected.x * 0.5 + 0.5) * width
      const y = (-projected.y * 0.5 + 0.5) * height
      const visible = projected.z > -1 && projected.z < 1

      label.element.style.transform = `translate3d(${x}px, ${y}px, 0)`
      label.element.style.opacity = visible ? '1' : '0'
    }
  }

  const animate = () => {
    globeFrame = window.requestAnimationFrame(animate)

    const elapsed = Date.now()

    if (!isDragging) {
      globeGroup.rotation.y += 0.0014
    }

    host.dataset.rotation = `${globeGroup.rotation.x.toFixed(4)},${globeGroup.rotation.y.toFixed(4)}`

    atmosphere.rotation.y -= 0.0009
    atmosphere.rotation.x += 0.0004

    dots.forEach((dot, index) => {
      const pulse = 1 + Math.sin(elapsed * 0.004 + index) * 0.32
      dot.scale.setScalar(pulse)
    })

    for (let index = dataPackets.length - 1; index >= 0; index -= 1) {
      const packet = dataPackets[index]
      if (!packet) continue

      packet.progress += packet.speed

      if (packet.progress >= 1) {
        globeGroup.remove(packet.mesh)
        packet.mesh.geometry.dispose()
        ;(packet.mesh.material as THREE.Material).dispose()
        dataPackets.splice(index, 1)
        continue
      }

      packet.mesh.position.copy(packet.curve.getPoint(packet.progress))
    }

    const now = Date.now()
    for (let index = activeArcs.length - 1; index >= 0; index -= 1) {
      const arc = activeArcs[index]
      if (!arc) continue

      const progress = (now - arc.startTime) / arc.duration
      const material = arc.line.material as THREE.LineBasicMaterial

      let drawCount = arc.totalPoints
      if (progress < 0.1) {
        drawCount = Math.floor((progress / 0.1) * arc.totalPoints)
      }

      arc.line.geometry.setDrawRange(0, drawCount)
      material.color.setHex(
        lightMode.value ? 0x333333 : deusOverlayVisible.value ? 0xe8ba78 : 0xe0c39b,
      )
      material.opacity =
        progress < 0.1
          ? (progress / 0.1) * 0.8
          : progress > 0.9
            ? ((1 - progress) / 0.1) * 0.8
            : 0.8

      if (progress >= 1) {
        arcsGroup.remove(arc.line)
        arc.line.geometry.dispose()
        material.dispose()
        activeArcs.splice(index, 1)
      }
    }

    wireframeMaterial.color.setHex(
      lightMode.value ? 0x000000 : deusOverlayVisible.value ? 0xe8ba78 : 0x5b3a27,
    )
    wireframeMaterial.opacity = deusOverlayVisible.value ? 0.72 : lightMode.value ? 0.42 : 0.38
    landMaterial.opacity = landTexture ? (lightMode.value ? 0.36 : 0.42) : 0
    landMaterial.color.setHex(lightMode.value ? 0x5f5f5f : 0xffffff)

    renderer.render(scene, camera)
    renderLabels()
  }

  resize()
  window.addEventListener('resize', resize)
  animate()

  disposeGlobe = () => {
    window.clearInterval(arcTimer)
    window.cancelAnimationFrame(globeFrame)
    window.removeEventListener('resize', resize)
    renderer.domElement.removeEventListener('pointerdown', handlePointerDown)
    renderer.domElement.removeEventListener('pointermove', handlePointerMove)
    renderer.domElement.removeEventListener('pointerup', handlePointerUp)
    renderer.domElement.removeEventListener('pointercancel', handlePointerUp)
    labels.forEach((label) => label.element.remove())
    activeArcs.forEach((arc) => {
      arc.line.geometry.dispose()
      ;(arc.line.material as THREE.Material).dispose()
    })
    dataPackets.forEach((packet) => {
      packet.mesh.geometry.dispose()
      ;(packet.mesh.material as THREE.Material).dispose()
    })
    globeGeometry.dispose()
    landGeometry.dispose()
    landTexture?.dispose()
    landMaterial.dispose()
    packetGeometry.dispose()
    wireframe.geometry.dispose()
    wireframeMaterial.dispose()
    core.geometry.dispose()
    ;(core.material as THREE.Material).dispose()
    atmosphere.geometry.dispose()
    ;(atmosphere.material as THREE.Material).dispose()
    realDotMaterial.dispose()
    ghostDotMaterial.dispose()
    packetMaterial.dispose()
    renderer.dispose()
    renderer.domElement.remove()
  }
}

onMounted(async () => {
  document.title = 'SAYONARA WORLD // SYSTEM_ROOT [GOODBYE_HUD_V1]'
  bootStopped = false
  startTime = Date.now()
  updateHudClock()
  hudTimer = window.setInterval(updateHudClock, 50)
  void loadBlogs()

  await nextTick()
  setupNoiseCanvas()
  setupGlobe()
  void runBootSequence()
})

onBeforeUnmount(() => {
  bootStopped = true
  disposeNoise?.()
  disposeGlobe?.()

  if (hudTimer !== undefined) window.clearInterval(hudTimer)
  if (chatTimer !== undefined) window.clearInterval(chatTimer)
  if (floodTimer !== undefined) window.clearInterval(floodTimer)
})
</script>

<template>
  <main
    class="wired-shell"
    :class="{ 'light-mode': lightMode, 'shake-screen': isFlooding }"
    :style="shellStyle"
    @mousemove="trackPointer"
  >
    <div class="main-stage" :class="{ 'is-revealed': !bootVisible || bootPhase === 'fade' }">
      <div ref="globeHost" class="globe-stage" aria-label="Interactive Sayonara World globe"></div>
      <canvas ref="noiseCanvas" class="shader-noise" aria-hidden="true"></canvas>

      <div class="crt-overlay" aria-hidden="true"></div>
      <div class="dither-overlay" aria-hidden="true"></div>
      <div class="scanline" aria-hidden="true"></div>

      <section class="ui-layer" aria-label="Sayonara World system HUD">
        <div class="hud-corner hud-tl hud-top-wing"></div>
        <div class="hud-corner hud-tr hud-top-wing"></div>
        <div class="hud-corner hud-bl hud-bottom-wing"></div>
        <div class="hud-corner hud-br hud-bottom-wing"></div>

        <aside class="status-panel hud-left-wing">
          <p>PROTOCOL: <span class="text-red pulse">SAYONARA_1.0</span></p>
          <p>CONNECTION: <span class="text-green">ESTABLISHED</span></p>
          <p>USER: <span class="glitch text-white" data-text="WORLD_404">WORLD_404</span></p>
          <p>PROXY: <span class="text-blue">GOODBYE_ROUTE (Node 23)</span></p>
          <p class="coords">{{ coords }}</p>
        </aside>

        <aside class="system-panel hud-right-wing">
          <div class="kv-row">
            <span>SYSTEM_ID:</span>
            <span class="text-white">SAYONARA_WORLD [LAYER-07]</span>
          </div>
          <div class="kv-row">
            <span>SERIAL:</span>
            <span>49-20-75-69-00</span>
          </div>
          <div class="kv-row">
            <span>SYS_TIME:</span>
            <span class="text-cyan">{{ hudTime }}</span>
          </div>
          <div class="kv-row">
            <span>UPTIME:</span>
            <span>{{ uptime }}</span>
          </div>
          <div class="kv-row">
            <span>STATUS:</span>
            <span class="text-green pulse">ONLINE / STABLE</span>
          </div>
          <div class="kv-row">
            <span>BLOG_FEED:</span>
            <span :class="blogFeedStatusClass">{{ blogFeedLine }}</span>
          </div>
          <div class="system-quote">"CLOSE THIS WORLD, OPEN SAYONARA"</div>
        </aside>

        <article
          v-for="(blog, index) in blogs"
          :key="blog.link"
          v-show="isBlogWindowVisible(blog)"
          class="window-box blog-window hud-center-wing"
          :style="blogWindowStyle(index)"
          @pointerdown="startBlogWindowDrag($event, blog)"
          @pointermove="moveBlogWindow($event, blog)"
          @pointerup="stopBlogWindowDrag($event, blog)"
          @pointercancel="stopBlogWindowDrag($event, blog)"
        >
          <header class="window-header blog-header">
            <span class="blog-window-title">
              <span class="blog-window-title-text">{{ blog.title }}</span>
              <span class="blog-window-extension">.html</span>
            </span>
            <button
              class="blog-window-action blog-window-x"
              type="button"
              aria-label="Close blog window"
              @pointerdown.stop
              @click.stop="closeBlogWindow(blog)"
            >
              ×
            </button>
          </header>
          <div class="blog-body">
            <p class="blog-question">
              <span class="blog-heart">♥</span>
              <span>{{ blog.description }}</span>
            </p>
            <div class="blog-actions">
              <button
                class="blog-window-action blog-choice"
                type="button"
                data-blog-action="open"
                @pointerdown.stop
                @click.stop="openBlog(blog)"
              >
                Yes(Y)
              </button>
              <button
                class="blog-window-action blog-choice"
                type="button"
                data-blog-action="close"
                @pointerdown.stop
                @click.stop="closeBlogWindow(blog)"
              >
                No(N)
              </button>
            </div>
          </div>
        </article>

        <section v-if="audioVisible" class="window-box audio-window hud-right-wing">
          <header class="window-header cyan-header">
            <span>SAYONARA_PLAYER.EXE</span>
            <button class="window-close" type="button" @click="audioVisible = false">[x]</button>
          </header>
          <div class="audio-body">
            <div class="visualizer">
              <span v-for="bar in 5" :key="bar"></span>
            </div>
            <p class="track glitch" data-text="TRACK: SAYONARA WORLD">TRACK: SAYONARA WORLD</p>
            <p class="artist">ARTIST: LAST SIGNAL [OFFLINE]</p>
            <div class="audio-actions">
              <button type="button" @click="flashConsole('PLAYING: SAYONARA_WORLD.OGG')">
                [ ▶ PLAY ]
              </button>
              <button type="button" @click="flashConsole('AUDIO PAUSED')">[ ⏸ PAUSE ]</button>
            </div>
          </div>
        </section>

        <section v-if="visorVisible" class="window-box visor-window hud-center-wing">
          <header class="window-header orange-header">
            <span>WORLD_HORIZON.SYS</span>
            <button class="window-close" type="button" @click="visorVisible = false">[x]</button>
          </header>
          <div class="visor-body">
            <p class="glitch" data-text="GOODBYE HUD CURVATURE">GOODBYE HUD CURVATURE</p>
            <label for="visor-curve-range">> INTENSITY: {{ curveIntensity }}%</label>
            <input
              id="visor-curve-range"
              v-model.number="curveIntensity"
              type="range"
              min="0"
              max="100"
            />
            <div class="range-labels">
              <span>FLAT</span>
              <span>CURVED</span>
            </div>
            <p class="projection-note">ADJUSTING NEXT WORLD PROJECTION...</p>
          </div>
        </section>

        <section v-if="chatVisible" class="window-box chat-window hud-center-wing">
          <header class="window-header purple-header">
            <span>SAYONARA_CHANNEL_7</span>
            <button class="window-close" type="button" @click="closeChat">[x]</button>
          </header>
          <div class="chat-body">
            <p class="text-green">> Opening farewell channel...</p>
            <p>--- BEGIN SAYONARA LOG ---</p>
            <p v-for="line in debugLines" :key="line.id">
              {{ line.text }}
            </p>
          </div>
        </section>

        <nav class="sidebar hud-left-wing" aria-label="Sayonara World controls">
          <button class="sidebar-btn text-green" type="button" @click="toggleDebugConsole">
            &gt; Toggle Debug
          </button>
          <button class="sidebar-btn text-blue" type="button" @click="openChat">
            &gt; Open Chat
          </button>
          <button class="sidebar-btn text-red pulse" type="button" @click="triggerFlood">
            &gt; ! FLOOD !
          </button>
          <button class="sidebar-btn text-purple" type="button" @click="reloadBlogs">
            &gt; Reload Blogs
          </button>
          <button class="sidebar-btn text-cyan" type="button" @click="openAudioPlayer">
            &gt; Sayonara Mix
          </button>
          <button class="sidebar-btn text-orange" type="button" @click="openVisorSettings">
            &gt; Visor Settings
          </button>
          <button class="sidebar-btn text-gray" type="button" @click="toggleLightMode">
            &gt; Light Mode
          </button>
          <button class="sidebar-btn text-gray" type="button" @click="triggerDeus">
            &gt; Sayonara Protocol
          </button>

          <div class="mem-dump">
            MEM_DUMP:<br />
            0x004F... OK<br />
            0x112B... CORRUPT<br />
            GOODBYE... N/A
          </div>
        </nav>

        <section class="bottom-copy hud-bottom-wing">
          <p class="wired-quote">"Internet Connect Us."</p>
          <p class="present-time">Present Day,Present Time.</p>
          <button
            id="disconnect-btn"
            class="disconnect-btn"
            type="button"
            :style="disconnectStyle"
            @click="handleDisconnect"
          >
            {{ disconnectText }}
          </button>
        </section>

        <div class="marquee-container hud-right-wing" aria-hidden="true">
          <div class="marquee-content">
            SAYONARA WORLD • GOODBYE OLD WORLD • OPEN THE NEXT WORLD • EVERYONE LEAVES A SIGNAL •
            LAST SIGNAL REMAINS • GOODBYE, WORLD • 再见，世界 •
          </div>
        </div>

        <aside v-if="debugVisible" class="debug-console">
          <div class="debug-title">&gt; SAYONARA_CONSOLE_V3</div>
          <div>&gt; TARGET_ID: {{ Math.floor((nextId * 7919) % 999999) }}</div>
          <div class="debug-stream">
            <p v-for="line in debugLines" :key="line.id">&gt; {{ line.text }}</p>
          </div>
        </aside>

        <div
          v-for="popup in floodPopups"
          :key="popup.id"
          class="flood-popup"
          :style="{
            left: `${popup.left}%`,
            top: `${popup.top}%`,
            transform: `rotate(${popup.rotation}deg)`,
          }"
        >
          <header>GOODBYE_ERROR</header>
          <strong>{{ popup.code }}</strong>
          <span>WORLD_SEGMENT_FAULT</span>
        </div>
      </section>

      <section v-if="deusWarningVisible" class="deus-warning">
        <h2 class="glitch" data-text="⚠ WARNING">⚠ WARNING</h2>
        <p>
          SAYONARA PROTOCOL INITIATED.<br />
          OLD WORLD INTEGRITY WILL BE COMPROMISED.<br />
          PROCEED?
        </p>
        <div>
          <button type="button" @click="confirmDeus">[ OPEN NEXT ]</button>
          <button type="button" @click="closeDeusWarning">[ STAY HERE ]</button>
        </div>
      </section>

      <section v-if="deusOverlayVisible" class="deus-overlay" @click="endDeusMode">
        <pre class="ascii-eye">
                                    ..,,;;;;;;;;,,..
                            ..,;;;;;;;;;;;;;;;;;;;;;;;;,,..
                    ..,;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;,,..
      </pre
        >
        <h2 class="glitch" data-text="SAYONARA IS WATCHING">SAYONARA IS WATCHING</h2>
        <p>GOODBYE CANNOT BE UNDONE. [CLICK TO DISMISS]</p>
      </section>
    </div>

    <section
      v-if="bootVisible"
      class="boot-screen"
      :class="`boot-${bootPhase}`"
      aria-label="Sayonara World boot sequence"
    >
      <div class="win98-loader" role="status" aria-live="polite">
        <header class="win98-titlebar">
          <span>SAYONARA_WORLD.EXE</span>
          <div class="win98-controls" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </header>

        <div class="win98-body">
          <div class="win98-logo">
            <span class="win98-flag red"></span>
            <span class="win98-flag green"></span>
            <span class="win98-flag blue"></span>
            <span class="win98-flag yellow"></span>
          </div>

          <div class="win98-copy">
            <h1>Sayonara World</h1>
            <p>{{ bootStatus }}</p>
          </div>

          <div class="win98-progress" aria-hidden="true">
            <span
              v-for="segment in 18"
              :key="segment"
              :class="{ active: bootProgress >= segment * (100 / 18) }"
            ></span>
          </div>

          <div class="win98-percent">{{ bootProgress }}%</div>
        </div>

        <footer class="win98-footer">Layer 07 farewell shell is preparing the next world.</footer>
      </div>
    </section>
  </main>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&family=Zen+Maru+Gothic:wght@500&display=swap');

.wired-shell {
  --lain-amber: #d6a36d;
  --lain-amber-bright: #f0bc77;
  --lain-amber-soft: #d2b08a;
  --lain-amber-dim: #a48769;
  --lain-brown: #2a1c16;
  --lain-brown-dark: #0e0a08;
  --lain-sage: #b8c79c;
  --wired-red: var(--lain-amber);
  --wired-dark-red: #5b3a27;
  --wired-cyan: var(--lain-amber-bright);
  --wired-bg: #14100d;
  --wired-text: #e0c39b;
  --glass-bg: rgba(4, 6, 8, 0.44);
  --lain-bg: url('/lain.png');

  position: fixed;
  inset: 0;
  min-height: 100vh;
  overflow: hidden;
  background: var(--wired-bg);
  color: var(--wired-text);
  cursor: crosshair;
  font-family: 'Press Start 2P', 'VT323', 'Zen Maru Gothic', monospace;
  font-size: clamp(10px, 0.75vw, 14px);
  image-rendering: pixelated;
  user-select: none;
  -webkit-font-smoothing: none;
}

.light-mode {
  --wired-bg: #f0f0f0;
  --wired-text: #050505;
  --glass-bg: rgba(250, 250, 250, 0.5);
  background: var(--wired-bg);
  color: var(--wired-text);
}

.main-stage {
  position: fixed;
  inset: 0;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 0.8s ease,
    filter 0.8s ease;
  filter: blur(2px);
}

.main-stage::before {
  position: fixed;
  inset: 0;
  z-index: 0;
  background:
    linear-gradient(rgba(0, 0, 0, 0.34), rgba(0, 0, 0, 0.76)),
    var(--lain-bg) center / cover no-repeat;
  opacity: 0.54;
  pointer-events: none;
  content: '';
}

.main-stage.is-revealed {
  opacity: 1;
  pointer-events: auto;
  filter: blur(0);
}

.globe-stage {
  position: fixed;
  inset: 0;
  z-index: 1;
  opacity: 0.68;
  pointer-events: auto;
}

:global(.wired-globe-canvas) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  touch-action: none;
}

:global(.globe-label) {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
  translate: -50% -50%;
  pointer-events: none;
  white-space: nowrap;
  transition:
    color 0.5s ease,
    text-shadow 0.5s ease,
    opacity 0.1s linear;
}

:global(.globe-label-city) {
  color: rgba(224, 195, 155, 0.76);
  font-family: 'VT323', monospace;
  font-size: 10px;
  text-shadow: 0 0 2px #000;
}

:global(.globe-label-ghost) {
  color: #b77a45;
  font-family: 'VT323', monospace;
  font-size: 9px;
  text-shadow: 0 0 5px rgba(214, 163, 109, 0.72);
  animation: blink 0.5s infinite;
}

.shader-noise,
.crt-overlay,
.dither-overlay,
.scanline {
  position: fixed;
  inset: 0;
  pointer-events: none;
}

.shader-noise {
  z-index: 0;
  opacity: 0.18;
}

.dither-overlay {
  z-index: 8;
  background-image: radial-gradient(rgba(214, 163, 109, 0.16) 1px, transparent 1px);
  background-size: 4px 4px;
  opacity: 0.13;
}

.crt-overlay {
  z-index: 9;
  background: linear-gradient(
    90deg,
    rgba(214, 163, 109, 0.06),
    rgba(184, 199, 156, 0.02),
    rgba(75, 51, 40, 0.06)
  );
  background-size: 3px 100%;
  box-shadow: inset 0 0 100px rgba(0, 0, 0, 0.8);
  animation: flicker 0.15s infinite;
}

.scanline {
  z-index: 10;
  height: 2px;
  background: rgba(214, 163, 109, 0.08);
  animation: scan 8s linear infinite;
}

.ui-layer {
  position: fixed;
  inset: 0;
  z-index: 4;
  overflow: hidden;
  border-radius: var(--screen-curve-rad);
  box-shadow: inset 0 0 200px rgba(0, 0, 0, var(--vignette-opacity));
  perspective: 1500px;
  pointer-events: none;
  transform-style: preserve-3d;
}

.ui-layer > * {
  pointer-events: auto;
}

.hud-left-wing {
  transform: perspective(1500px) rotateY(var(--curve-angle))
    translateX(calc(var(--curve-spacing) * -0.5)) scale(var(--ui-scale));
  transform-origin: left center;
}

.hud-right-wing {
  transform: perspective(1500px) rotateY(calc(var(--curve-angle) * -1))
    translateX(calc(var(--curve-spacing) * -0.5)) scale(var(--ui-scale));
  transform-origin: right center;
}

.hud-bottom-wing {
  transform: perspective(1500px) rotateX(calc(var(--curve-angle) * 1.5)) translateY(20px)
    scale(var(--ui-scale));
  transform-origin: center bottom;
}

.hud-top-wing {
  transform: perspective(1500px) rotateX(calc(var(--curve-angle) * -1)) scale(var(--ui-scale));
  transform-origin: center top;
}

.hud-center-wing {
  transform: perspective(1500px) translateZ(-20px) rotateX(1deg) scale(var(--ui-scale));
  transform-style: preserve-3d;
}

.hud-corner {
  position: fixed;
  width: 2.5rem;
  height: 2.5rem;
  border: 2px solid rgba(214, 163, 109, 0.16);
  pointer-events: none;
}

.hud-tl {
  top: 0.6rem;
  left: 0.6rem;
  border-right: 0;
  border-bottom: 0;
  border-top-left-radius: 1rem;
}

.hud-tr {
  top: 0.6rem;
  right: 0.6rem;
  border-bottom: 0;
  border-left: 0;
  border-top-right-radius: 1rem;
}

.hud-bl {
  bottom: 0.6rem;
  left: 0.6rem;
  border-top: 0;
  border-right: 0;
  border-bottom-left-radius: 1rem;
}

.hud-br {
  right: 0.6rem;
  bottom: 0.6rem;
  border-top: 0;
  border-left: 0;
  border-bottom-right-radius: 1rem;
}

.status-panel,
.system-panel {
  position: absolute;
  z-index: 5;
  border: 1px solid var(--wired-red);
  background: rgba(14, 10, 8, 0.56);
  box-shadow: 0 0 10px rgba(214, 163, 109, 0.18);
  backdrop-filter: blur(4px);
}

.status-panel {
  top: 2.1rem;
  left: 1.3rem;
  width: 270px;
  padding: 0.65rem;
  border-width: 0 0 0 2px;
  color: var(--lain-amber-dim);
  line-height: 1.55;
  letter-spacing: 0.08em;
}

.coords {
  margin-top: 0.5rem;
  color: var(--lain-amber-soft);
  font-size: 0.62rem;
}

.system-panel {
  top: 2.7rem;
  right: 1.7rem;
  width: 255px;
  padding: 0.65rem;
  color: var(--wired-red);
  font-family: 'VT323', monospace;
  font-size: 0.8rem;
  line-height: 1.2;
}

.kv-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.system-quote {
  margin-top: 0.55rem;
  padding-top: 0.4rem;
  border-top: 1px solid rgba(214, 163, 109, 0.28);
  color: var(--lain-amber-dim);
  font-size: 0.62rem;
  text-align: center;
  letter-spacing: 0.12em;
}

.window-box {
  position: absolute;
  z-index: 6;
  border: 1px solid rgba(214, 163, 109, 0.44);
  background: var(--glass-bg);
  box-shadow: 5px 5px 0 rgba(14, 10, 8, 0.58);
  color: var(--wired-text);
  font-family: 'VT323', monospace;
  font-size: 0.95rem;
  backdrop-filter: blur(4px);
}

.window-box:hover {
  border-color: var(--wired-cyan);
}

.window-header {
  display: flex;
  min-height: 22px;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.45rem;
  font-family: 'Press Start 2P', monospace;
  font-size: 0.62rem;
}

.red-header {
  border-bottom: 1px solid rgba(214, 163, 109, 0.42);
  background: rgba(43, 29, 22, 0.45);
  color: var(--lain-amber-bright);
}

.yellow-header {
  background: rgba(83, 55, 36, 0.55);
  color: var(--lain-amber-bright);
}

.cyan-header {
  border-bottom: 1px solid rgba(214, 163, 109, 0.38);
  background: rgba(43, 29, 22, 0.5);
  color: var(--lain-amber-bright);
}

.orange-header {
  border-bottom: 1px solid rgba(214, 163, 109, 0.38);
  background: rgba(61, 41, 30, 0.55);
  color: var(--lain-amber-bright);
}

.purple-header {
  background: rgba(61, 41, 30, 0.55);
  color: var(--lain-amber-bright);
}

.window-close {
  margin-left: auto;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
}

.blog-window {
  display: block;
  min-height: 134px;
  border: 2px solid;
  border-color: rgba(231, 181, 117, 0.76) rgba(31, 20, 16, 0.92) rgba(31, 20, 16, 0.92)
    rgba(231, 181, 117, 0.76);
  background: rgba(14, 10, 8, 0.42);
  box-shadow:
    5px 5px 0 rgba(0, 0, 0, 0.7),
    inset 1px 1px 0 rgba(238, 189, 126, 0.24);
  color: var(--wired-text);
  cursor: move;
  overflow: hidden;
  touch-action: none;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.blog-window:hover {
  box-shadow:
    5px 5px 0 rgba(0, 0, 0, 0.7),
    0 0 18px rgba(214, 163, 109, 0.2),
    inset 1px 1px 0 rgba(238, 189, 126, 0.24);
}

.blog-header {
  justify-content: flex-start;
  min-height: 27px;
  border-bottom: 1px solid rgba(214, 163, 109, 0.5);
  background:
    linear-gradient(90deg, rgba(87, 58, 38, 0.76), rgba(43, 29, 22, 0.62)),
    repeating-linear-gradient(90deg, rgba(214, 163, 109, 0.1) 0 1px, transparent 1px 8px);
  color: var(--lain-amber-bright);
}

.blog-window-title {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  align-items: center;
}

.blog-window-title-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.blog-window-extension {
  flex: 0 0 auto;
}

.blog-window-action {
  border: 1px solid;
  border-color: rgba(238, 189, 126, 0.84) rgba(31, 20, 16, 0.9) rgba(31, 20, 16, 0.9)
    rgba(238, 189, 126, 0.84);
  background: rgba(224, 195, 155, 0.15);
  color: var(--lain-amber-bright);
  cursor: pointer;
  font: inherit;
}

.blog-window-action:active {
  border-color: rgba(31, 20, 16, 0.9) rgba(238, 189, 126, 0.84) rgba(238, 189, 126, 0.84)
    rgba(31, 20, 16, 0.9);
  translate: 1px 1px;
}

.blog-window-x {
  width: 22px;
  height: 20px;
  flex: 0 0 auto;
  padding: 0;
  line-height: 1;
}

.blog-body,
.audio-body,
.visor-body,
.chat-body {
  background: rgba(0, 0, 0, 0.46);
  padding: 0.8rem;
}

.blog-body {
  display: block;
  min-height: 104px;
  border-top: 1px solid rgba(214, 163, 109, 0.08);
  color: var(--lain-amber-soft);
  padding: 0.65rem 0.85rem 0.75rem;
}

.blog-question {
  display: flex;
  min-height: 42px;
  align-items: flex-start;
  gap: 0.5rem;
  margin: 0 0 0.75rem;
  color: var(--lain-sage);
  font-size: 0.92rem;
  line-height: 1.25;
}

.blog-heart {
  flex: 0 0 auto;
  color: var(--lain-amber-bright);
  font-size: 1rem;
  line-height: 1.1;
}

.blog-actions {
  display: flex;
  justify-content: center;
  gap: 1.1rem;
}

.blog-choice {
  min-width: 86px;
  min-height: 30px;
  padding: 0.25rem 0.7rem;
}

.audio-window {
  top: 46%;
  right: 8%;
  width: 245px;
}

.visualizer {
  display: flex;
  height: 34px;
  align-items: end;
  justify-content: center;
  gap: 4px;
  margin-bottom: 0.6rem;
  border-bottom: 1px solid rgba(214, 163, 109, 0.28);
  padding-bottom: 0.35rem;
}

.visualizer span {
  width: 4px;
  min-height: 4px;
  background: var(--wired-cyan);
  animation: bounce 0.5s infinite alternate;
}

.visualizer span:nth-child(2) {
  animation-delay: 0.12s;
}

.visualizer span:nth-child(3) {
  animation-delay: 0.24s;
}

.visualizer span:nth-child(4) {
  animation-delay: 0.36s;
}

.visualizer span:nth-child(5) {
  animation-delay: 0.48s;
}

.track {
  color: var(--wired-cyan);
  text-align: center;
}

.artist {
  margin: 0.4rem 0 0.65rem;
  color: var(--lain-amber-dim);
  font-size: 0.75rem;
  text-align: center;
}

.audio-actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
}

.audio-actions button {
  border: 0;
  background: transparent;
  color: var(--lain-amber-bright);
  cursor: pointer;
  font: inherit;
}

.visor-window {
  top: 29%;
  left: 16%;
  width: 280px;
}

.visor-body {
  display: grid;
  gap: 0.65rem;
  color: var(--lain-amber-bright);
  text-align: center;
}

.visor-body label,
.range-labels,
.projection-note {
  color: var(--lain-amber-dim);
  font-size: 0.74rem;
}

.visor-body input {
  width: 100%;
  accent-color: var(--wired-cyan);
}

.range-labels {
  display: flex;
  justify-content: space-between;
  opacity: 0.65;
}

.projection-note {
  border-top: 1px solid rgba(214, 163, 109, 0.18);
  padding-top: 0.55rem;
  color: #7d684f;
}

.chat-window {
  top: 18%;
  left: 18%;
  width: 320px;
}

.chat-body {
  height: 230px;
  overflow: hidden;
  color: var(--lain-amber-soft);
  line-height: 1.35;
}

.sidebar {
  position: absolute;
  top: 26%;
  left: 0.65rem;
  z-index: 6;
  display: flex;
  width: 150px;
  flex-direction: column;
  gap: 0.45rem;
}

.sidebar-btn {
  min-height: 31px;
  border: 0;
  border-left: 2px solid transparent;
  background: rgba(14, 10, 8, 0.34);
  color: inherit;
  cursor: pointer;
  font: inherit;
  line-height: 1.25;
  padding: 0.42rem 0.55rem;
  text-align: left;
  transition:
    background 0.2s,
    color 0.2s,
    padding-left 0.2s,
    border-color 0.2s;
}

.sidebar-btn:hover {
  border-left-color: currentColor;
  background: var(--wired-red);
  color: var(--lain-brown-dark);
  padding-left: 0.85rem;
  text-decoration: line-through;
}

.mem-dump {
  margin-top: 0.6rem;
  border-left: 1px solid rgba(214, 163, 109, 0.2);
  padding-left: 0.65rem;
  color: #7d684f;
  font-size: 0.62rem;
  line-height: 1.4;
}

.bottom-copy {
  position: absolute;
  right: 0;
  bottom: 3rem;
  left: 0;
  z-index: 5;
  text-align: center;
}

.wired-quote {
  margin-bottom: 0.35rem;
  color: var(--lain-amber-soft);
  font-family: 'Zen Maru Gothic', serif;
  font-size: clamp(1rem, 1.4vw, 1.35rem);
  font-style: italic;
  text-shadow:
    0 0 5px var(--wired-red),
    0 0 10px var(--wired-red);
}

.present-time {
  margin-bottom: 1rem;
  color: #8a5f3b;
  font-size: 0.62rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.disconnect-btn {
  border: 1px solid var(--wired-red);
  background: transparent;
  color: var(--wired-red);
  cursor: pointer;
  font: inherit;
  min-height: 36px;
  min-width: 170px;
  padding: 0.6rem 1.2rem;
  transition:
    background 0.25s,
    color 0.25s,
    transform 0.25s;
}

.disconnect-btn:hover {
  background: var(--wired-red);
  color: var(--lain-brown-dark);
}

.marquee-container {
  position: absolute;
  top: 15%;
  right: 1.25rem;
  bottom: 15%;
  z-index: 4;
  overflow: hidden;
  pointer-events: none;
  mask-image: linear-gradient(to bottom, transparent, #000 10%, #000 90%, transparent);
}

.marquee-content {
  color: #8a5f3b;
  font-family: 'Zen Maru Gothic', serif;
  font-size: clamp(2.1rem, 3.2vw, 3.3rem);
  font-weight: 700;
  writing-mode: vertical-rl;
  animation: scrollUp 40s linear infinite;
}

.debug-console {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 20;
  width: 300px;
  border-right: 1px solid var(--lain-sage);
  border-bottom: 1px solid var(--lain-sage);
  background: rgba(14, 10, 8, 0.9);
  color: var(--lain-sage);
  font-family: 'VT323', monospace;
  font-size: 0.9rem;
  padding: 0.45rem;
}

.debug-title {
  margin-bottom: 0.35rem;
  border-bottom: 1px solid rgba(184, 199, 156, 0.52);
  padding-bottom: 0.25rem;
}

.debug-stream {
  margin-top: 0.5rem;
  color: var(--lain-amber-soft);
}

.flood-popup {
  position: fixed;
  z-index: 30;
  width: 220px;
  border: 1px solid var(--wired-red);
  background: rgba(14, 10, 8, 0.92);
  box-shadow: 5px 5px 0 rgba(0, 0, 0, 0.5);
  color: var(--wired-red);
  font-family: 'VT323', monospace;
  text-align: center;
}

.flood-popup header {
  background: rgba(83, 55, 36, 0.82);
  color: var(--lain-amber-bright);
  font-size: 0.8rem;
  padding: 0.2rem 0.35rem;
  text-align: left;
}

.flood-popup strong {
  display: block;
  padding-top: 0.8rem;
  font-size: 1.55rem;
}

.flood-popup span {
  display: block;
  padding-bottom: 0.8rem;
  color: var(--lain-amber-soft);
  font-size: 0.82rem;
}

.deus-warning,
.deus-overlay,
.boot-screen {
  position: fixed;
  inset: 0;
  z-index: 40;
}

.deus-warning {
  inset: 50% auto auto 50%;
  display: flex;
  width: min(330px, calc(100vw - 32px));
  flex-direction: column;
  gap: 0.85rem;
  border: 2px solid var(--wired-red);
  background: rgba(0, 0, 0, 0.95);
  box-shadow: 0 0 20px var(--wired-red);
  color: #d1d5db;
  padding: 1.2rem;
  text-align: center;
  translate: -50% -50%;
}

.deus-warning h2 {
  color: var(--wired-red);
}

.deus-warning div {
  display: flex;
  justify-content: center;
  gap: 0.65rem;
}

.deus-warning button {
  border: 1px solid currentColor;
  background: transparent;
  color: var(--wired-red);
  cursor: pointer;
  font: inherit;
  padding: 0.45rem 0.55rem;
}

.deus-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.95);
  color: var(--wired-red);
  cursor: none;
}

.deus-overlay h2 {
  font-size: clamp(2rem, 6vw, 4.5rem);
}

.deus-overlay p {
  margin-top: 1rem;
  color: var(--lain-amber-bright);
}

.ascii-eye {
  color: var(--wired-red);
  font-size: 0.65rem;
  line-height: 0.65rem;
  text-shadow: 0 0 20px var(--wired-red);
}

.boot-screen {
  display: grid;
  place-items: center;
  overflow: hidden;
  font-family: Tahoma, 'MS Sans Serif', Arial, sans-serif;
  transition:
    background 1.35s ease,
    opacity 1.35s ease;
}

.boot-screen::before,
.boot-screen::after {
  position: absolute;
  inset: 0;
  pointer-events: none;
  content: '';
  transition: opacity 0.8s ease;
}

.boot-screen::before {
  background:
    linear-gradient(rgba(214, 156, 94, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(214, 156, 94, 0.06) 1px, transparent 1px);
  background-size:
    100% 5px,
    5px 100%;
  opacity: 0.4;
}

.boot-screen::after {
  background: repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.05) 0 1px, transparent 1px 4px);
  mix-blend-mode: screen;
  opacity: 0.3;
}

.boot-win98 {
  background:
    linear-gradient(rgba(35, 24, 18, 0.52), rgba(34, 22, 16, 0.84)),
    linear-gradient(115deg, rgba(212, 157, 92, 0.12), transparent 36%),
    var(--lain-bg) center / cover no-repeat,
    #2a1c16;
  color: #e0b985;
}

.boot-fade {
  background: transparent;
  pointer-events: none;
}

.boot-fade::before,
.boot-fade::after {
  opacity: 0;
}

.win98-loader {
  position: relative;
  z-index: 1;
  width: min(560px, calc(100vw - 32px));
  border: 2px solid;
  border-color: rgba(214, 163, 109, 0.78) rgba(31, 20, 16, 0.86) rgba(31, 20, 16, 0.86)
    rgba(214, 163, 109, 0.78);
  background: rgba(14, 10, 8, 0.48);
  box-shadow:
    8px 8px 0 rgba(0, 0, 0, 0.8),
    0 0 32px rgba(0, 0, 0, 0.42),
    inset 1px 1px 0 rgba(238, 189, 126, 0.52),
    inset -1px -1px 0 rgba(31, 20, 16, 0.95);
  backdrop-filter: blur(3px);
  image-rendering: pixelated;
  transition:
    opacity 0.8s ease,
    transform 0.8s ease,
    filter 0.8s ease;
}

.boot-fade .win98-loader {
  opacity: 0;
  transform: translateY(-12px) scale(0.98);
  filter: blur(4px);
}

.win98-loader::before {
  position: absolute;
  inset: 10px;
  border: 1px solid rgba(214, 156, 94, 0.18);
  pointer-events: none;
  content: '';
}

.win98-titlebar {
  display: flex;
  min-height: 28px;
  align-items: center;
  justify-content: space-between;
  margin: 2px;
  background:
    linear-gradient(90deg, rgba(83, 55, 36, 0.62), rgba(24, 16, 12, 0.42) 62%, rgba(0, 0, 0, 0.32)),
    repeating-linear-gradient(90deg, rgba(238, 189, 126, 0.14) 0 1px, transparent 1px 4px);
  color: #ffe0b4;
  font-family: 'Press Start 2P', monospace;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 0 0.35rem 0 0.55rem;
  text-shadow: 0 0 8px rgba(230, 170, 104, 0.65);
}

.win98-controls {
  display: flex;
  gap: 2px;
}

.win98-controls span {
  width: 17px;
  height: 15px;
  border: 1px solid;
  border-color: #e1ad76 #241711 #241711 #e1ad76;
  background: #332119;
  box-shadow: inset -1px -1px 0 #6d492f;
}

.win98-body {
  display: grid;
  grid-template-columns: 74px 1fr;
  gap: 0.8rem;
  padding: 1.2rem 1.2rem 0.8rem;
}

.win98-logo {
  position: relative;
  width: 58px;
  height: 50px;
  margin-top: 0.1rem;
  filter: drop-shadow(0 0 12px rgba(214, 156, 94, 0.52));
}

.win98-flag {
  position: absolute;
  width: 25px;
  height: 21px;
  border: 1px solid rgba(231, 181, 117, 0.65);
  background-image: repeating-linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.2) 0 1px,
    transparent 1px 4px
  );
}

.win98-flag.red {
  top: 0;
  left: 3px;
  background-color: #d1965b;
}

.win98-flag.green {
  top: 0;
  left: 30px;
  background-color: #8a5f3b;
}

.win98-flag.blue {
  top: 24px;
  left: 0;
  background-color: #4b3328;
}

.win98-flag.yellow {
  top: 24px;
  left: 27px;
  background-color: #b77a45;
}

.win98-copy h1 {
  margin: 0 0 0.65rem;
  color: #f0bc77;
  font-family: 'Press Start 2P', monospace;
  font-size: clamp(1rem, 2vw, 1.38rem);
  font-weight: 400;
  letter-spacing: 0.06em;
  text-shadow:
    0 0 8px rgba(214, 156, 94, 0.7),
    2px 0 0 rgba(66, 46, 35, 0.56);
}

.win98-copy p {
  min-height: 1.4em;
  margin: 0 0 0.8rem;
  color: #d2b08a;
  font-family: 'VT323', monospace;
  font-size: 1.15rem;
  letter-spacing: 0.04em;
}

.win98-progress {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(18, 1fr);
  gap: 2px;
  height: 23px;
  border: 2px solid;
  border-color: #1e140f #d7a166 #d7a166 #1e140f;
  background: #17100d;
  padding: 3px;
}

.win98-progress span {
  background: rgba(214, 156, 94, 0.08);
}

.win98-progress span.active {
  background: linear-gradient(180deg, #e8ba78, #8c5d38);
  box-shadow: 0 0 10px rgba(214, 156, 94, 0.5);
}

.win98-percent {
  grid-column: 1 / -1;
  justify-self: end;
  color: #ddb17b;
  font-family: 'VT323', monospace;
  font-size: 1rem;
}

.win98-footer {
  border-top: 1px solid rgba(214, 156, 94, 0.24);
  color: #a48769;
  font-family: 'VT323', monospace;
  font-size: 0.95rem;
  letter-spacing: 0.06em;
  padding: 0.45rem 0.75rem 0.65rem;
}

.text-red {
  color: var(--wired-red);
}

.text-green {
  color: var(--lain-sage);
}

.text-blue {
  color: var(--lain-amber-soft);
}

.text-cyan {
  color: var(--wired-cyan);
}

.text-purple {
  color: #b77a45;
}

.text-orange {
  color: #c99057;
}

.text-gray {
  color: var(--lain-amber-dim);
}

.text-white {
  color: #f2dcc0;
}

.pulse {
  animation: pulse 1.2s infinite;
}

.glitch {
  position: relative;
}

.glitch::before,
.glitch::after {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--wired-bg);
  content: attr(data-text);
}

.glitch::before {
  left: 2px;
  clip-path: polygon(0 0, 100% 0, 100% 45%, 0 45%);
  text-shadow: -1px 0 var(--wired-red);
  animation: glitchOne 2.5s infinite linear alternate-reverse;
}

.glitch::after {
  left: -2px;
  clip-path: polygon(0 55%, 100% 55%, 100% 100%, 0 100%);
  text-shadow: -1px 0 var(--wired-cyan);
  animation: glitchTwo 3s infinite linear alternate-reverse;
}

.shake-screen {
  animation: shakeHard 0.1s cubic-bezier(0.36, 0.07, 0.19, 0.97) infinite;
}

@keyframes flicker {
  0% {
    opacity: 0.94;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.96;
  }
}

@keyframes scan {
  0% {
    top: 0;
  }
  100% {
    top: 100%;
  }
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}

@keyframes bounce {
  0% {
    height: 5px;
  }
  100% {
    height: 24px;
  }
}

@keyframes scrollUp {
  0% {
    transform: translateY(100%);
  }
  100% {
    transform: translateY(-150%);
  }
}

@keyframes glitchOne {
  0% {
    clip-path: inset(20% 0 80% 0);
  }
  20% {
    clip-path: inset(60% 0 10% 0);
  }
  40% {
    clip-path: inset(40% 0 50% 0);
  }
  60% {
    clip-path: inset(80% 0 5% 0);
  }
  80% {
    clip-path: inset(10% 0 70% 0);
  }
  100% {
    clip-path: inset(30% 0 20% 0);
  }
}

@keyframes glitchTwo {
  0% {
    clip-path: inset(10% 0 60% 0);
  }
  20% {
    clip-path: inset(30% 0 20% 0);
  }
  40% {
    clip-path: inset(70% 0 10% 0);
  }
  60% {
    clip-path: inset(20% 0 50% 0);
  }
  80% {
    clip-path: inset(50% 0 30% 0);
  }
  100% {
    clip-path: inset(5% 0 80% 0);
  }
}

@keyframes shakeHard {
  0% {
    transform: translate(0, 0) rotate(0deg);
  }
  25% {
    transform: translate(2px, 2px) rotate(1deg);
  }
  50% {
    transform: translate(-2px, -2px) rotate(-1deg);
  }
  75% {
    transform: translate(-2px, 2px) rotate(0deg);
  }
  100% {
    transform: translate(2px, -2px) rotate(0deg);
  }
}

@media (max-width: 760px) {
  .wired-shell {
    font-size: 9px;
  }

  .status-panel {
    top: 1.4rem;
    left: 1rem;
    width: min(260px, calc(100vw - 2rem));
  }

  .system-panel {
    top: 8.6rem;
    right: 1rem;
    width: min(245px, calc(100vw - 2rem));
  }

  .blog-window {
    rotate: 0deg;
  }

  .blog-window:hover {
    border-color: var(--wired-cyan);
  }

  .blog-body {
    min-height: 78px;
    padding: 0.65rem;
  }

  .blog-question {
    font-size: 0.78rem;
  }

  .audio-window,
  .visor-window,
  .chat-window {
    top: 32%;
    right: 1rem;
    left: 1rem;
    width: auto;
  }

  .sidebar {
    top: auto;
    bottom: 7.8rem;
    left: 0.9rem;
    width: 132px;
    gap: 0.28rem;
  }

  .sidebar-btn {
    min-height: 26px;
    padding: 0.32rem 0.45rem;
  }

  .mem-dump {
    display: none;
  }

  .bottom-copy {
    bottom: 1.2rem;
    padding-inline: 1rem;
  }

  .marquee-container {
    right: 0.5rem;
    opacity: 0.55;
  }
}
</style>
