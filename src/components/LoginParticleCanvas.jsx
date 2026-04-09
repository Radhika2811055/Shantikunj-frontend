import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

const LoginParticleCanvas = () => {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    const count = window.innerWidth < 900 ? 9000 : 20000
    const speedMult = 1

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x000000, 0.01)

    const width = container.clientWidth || window.innerWidth
    const height = container.clientHeight || window.innerHeight

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 2000)
    camera.position.set(0, 0, 135)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(width, height)
    renderer.setClearColor(0x000000, 1)
    container.appendChild(renderer.domElement)

    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))

    const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 1.8, 0.4, 0.85)
    bloomPass.strength = 1.8
    bloomPass.radius = 0.4
    bloomPass.threshold = 0
    composer.addPass(bloomPass)

    const dummy = new THREE.Object3D()
    const target = new THREE.Vector3()
    const pColor = new THREE.Color()

    const geometry = new THREE.TetrahedronGeometry(0.25)
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })

    const mesh = new THREE.InstancedMesh(geometry, material, count)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mesh.frustumCulled = false
    scene.add(mesh)

    const positions = []
    const initColor = new THREE.Color(0x00ff88)
    for (let i = 0; i < count; i += 1) {
      positions.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 100,
          (Math.random() - 0.5) * 100,
          (Math.random() - 0.5) * 100,
        ),
      )
      mesh.setColorAt(i, initColor)
    }

    const PARAMS = {
      scale: 100,
      spread: 1.74,
      margin: 2,
      kernel: 2.5,
      rotate: 3.14159,
      flow: 1.1,
      support: 3,
      bias: 1.2,
    }

    const addControl = (id, _label, _min, _max, defaultValue) => (
      PARAMS[id] !== undefined ? PARAMS[id] : defaultValue
    )

    const clock = new THREE.Clock()
    let rafId = 0

    const animate = () => {
      rafId = window.requestAnimationFrame(animate)
      const time = clock.getElapsedTime() * speedMult

      const scale = addControl('scale', 'Feature Space Scale', 20, 220, 95)
      const spread = addControl('spread', 'Class Spread', 0.2, 3.0, 1.25)
      const margin = addControl('margin', 'Margin Width', 2, 80, 22)
      const kernel = addControl('kernel', 'Kernel Warp', 0, 2.5, 0.85)
      const rotate = addControl('rotate', 'Hyperplane Rotation', -3.14159, 3.14159, 0.6)
      const flow = addControl('flow', 'Training Flow', 0, 3, 1.0)
      const support = addControl('support', 'Support Density', 0.1, 3.0, 1.2)
      const biasCtrl = addControl('bias', 'Bias Shift', -60, 60, 0)

      // Explicit looped timeline so motion cycles smoothly forever.
      const loopDuration = 36
      const loopProgress = (time % loopDuration) / loopDuration
      const loopAngle = loopProgress * Math.PI * 2
      const t = loopAngle * flow * 4

      // Subtle camera drift for a slightly zoomed-out cinematic feel.
      camera.position.x = Math.sin(loopAngle * 0.4) * 14
      camera.position.y = Math.cos(loopAngle * 0.35) * 8
      camera.position.z = 135 + Math.sin(loopAngle * 0.5) * 6
      camera.lookAt(0, 0, 0)

      for (let i = 0; i < count; i += 1) {
        const TAU = 6.283185307179586
        const u = (i + 0.5) / count
        const cls = i < count * 0.5 ? -1.0 : 1.0
        const local = cls < 0.0 ? u * 2.0 : (u - 0.5) * 2.0

        const ga = 2.399963229728653
        const ang = i * ga + t * 0.18
        const rad = scale * spread * Math.sqrt(local + 0.000001)

        const ca = Math.cos(ang)
        const sa = Math.sin(ang)

        const cy = (rad * ca) / (1.0 + (0.22 * kernel * rad) / (scale + 0.000001))
        const cz = (rad * sa) / (1.0 + (0.18 * kernel * rad) / (scale + 0.000001))

        const nx = Math.cos(rotate)
        const ny = Math.sin(rotate) * 0.72
        const nz = Math.sin(rotate * 0.7) * 0.42

        const nLen = 1.0 / Math.sqrt(nx * nx + ny * ny + nz * nz + 0.000001)
        const ux = nx * nLen
        const uy = ny * nLen
        const uz = nz * nLen

        const baseSep = margin * (1.25 + 0.75 * Math.sin(t * 0.35))
        const shell = Math.cos(local * TAU * support + t * 0.55)
        const shellAbs = Math.abs(shell)
        const nearMargin = 1.0 - Math.pow(shellAbs, 0.65)
        const offset = cls * (baseSep + margin * 0.9 * nearMargin) + biasCtrl

        const px0 = ux * offset
        const py0 = uy * offset + cy
        const pz0 = uz * offset + cz

        const score0 = ux * px0 + uy * py0 + uz * pz0 - biasCtrl
        const warp = kernel * (
          0.22 * Math.sin(py0 * 0.045 + t + cls * 0.9)
          + 0.18 * Math.cos(pz0 * 0.04 - t * 0.8)
          + 0.12 * Math.sin((py0 + pz0) * 0.028 + score0 * 0.03)
        ) * scale

        const px = px0 + ux * warp
        const py = py0 + 0.16 * warp * Math.sin(ang * 0.7 + t * 0.4)
        const pz = pz0 + 0.16 * warp * Math.cos(ang * 0.6 - t * 0.5)

        target.set(px, py, pz)

        const score = ux * px + uy * py + uz * pz - biasCtrl
        const dist = Math.abs(score)
        const marginNorm = dist / (margin + 0.000001)
        const svGlow = Math.exp(-marginNorm * marginNorm * 1.6)
        const classHue = cls > 0.0 ? 0.58 : 0.02
        const hue = classHue + 0.08 * svGlow + 0.03 * Math.sin(ang * 0.2 + t * 0.25)
        const sat = 0.72 + 0.26 * svGlow
        const lit = 0.34 + 0.18 * (1.0 - Math.min(1.0, marginNorm)) + 0.22 * svGlow + 0.08 * local

        pColor.setHSL(hue - Math.floor(hue), sat, lit)

        positions[i].lerp(target, 0.1)
        dummy.position.copy(positions[i])
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
        mesh.setColorAt(i, pColor)
      }

      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true
      }

      composer.render()
    }

    const onResize = () => {
      const nextWidth = container.clientWidth || window.innerWidth
      const nextHeight = container.clientHeight || window.innerHeight

      camera.aspect = nextWidth / nextHeight
      camera.updateProjectionMatrix()
      renderer.setSize(nextWidth, nextHeight)
      composer.setSize(nextWidth, nextHeight)
      bloomPass.setSize(nextWidth, nextHeight)
    }

    window.addEventListener('resize', onResize)
    animate()

    return () => {
      window.removeEventListener('resize', onResize)
      window.cancelAnimationFrame(rafId)
      scene.remove(mesh)
      geometry.dispose()
      material.dispose()
      composer.dispose?.()
      renderer.dispose()
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <div className="login-particle-canvas" ref={containerRef} aria-hidden="true" />
  )
}

export default LoginParticleCanvas
