'use strict';

// Three.js presentation for the garden. Interactive and accessible controls live
// in shell.html; this module mirrors model state without owning game rules.
(() => {
  const PLANT_COLORS = {
    sunflower: 0xf1c453,
    dewcup: 0x78b9ad,
    mint: 0x68a66d,
    moonflower: 0xc7b8e8,
    dandelion: 0xf4df84,
    bellflower: 0xa999d5,
    thorn: 0x668b5d,
    glowcap: 0xb6cc8d
  };

  function disposeObject(root) {
    const geometries = new Set();
    const materials = new Set();
    root.traverse(object => {
      if (!object.isMesh) return;
      if (object.geometry) geometries.add(object.geometry);
      const items = Array.isArray(object.material) ? object.material : [object.material];
      items.forEach(material => { if (material) materials.add(material); });
    });
    geometries.forEach(geometry => geometry.dispose?.());
    materials.forEach(material => material.dispose?.());
  }

  function create(context) {
    const { scene, camera } = context;
    const root = new THREE.Group();
    root.name = 'mosswing-garden-root';
    root.visible = false;
    scene.add(root);

    const soilMaterial = new THREE.MeshStandardMaterial({ color: 0x87a984, roughness: 1, flatShading: true });
    const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0x55756b, roughness: 1, flatShading: true });
    const heartMaterial = new THREE.MeshStandardMaterial({ color: 0xf2b579, emissive: 0x5f3216, emissiveIntensity: .16, roughness: .75, flatShading: true });
    const blightMaterial = new THREE.MeshStandardMaterial({ color: 0x75677d, roughness: .9, flatShading: true });
    const tileGeometry = new THREE.CylinderGeometry(.76, .62, .26, 6);
    const edgeGeometry = new THREE.CylinderGeometry(.83, .45, .7, 6);
    const heartGeometries = {
      balanced: new THREE.IcosahedronGeometry(.46, 1),
      reservoir: new THREE.SphereGeometry(.43, 12, 8),
      moon: new THREE.OctahedronGeometry(.48, 1)
    };
    const heartColors = { balanced: 0xf2b579, reservoir: 0x69b8bc, moon: 0xb7a8dc };
    const plantGeometries = {
      sunflower: new THREE.ConeGeometry(.31, .82, 7),
      dewcup: new THREE.CylinderGeometry(.33, .13, .58, 7),
      mint: new THREE.BoxGeometry(.43, .68, .28, 1, 1, 1),
      moonflower: new THREE.OctahedronGeometry(.38, 0),
      dandelion: new THREE.IcosahedronGeometry(.34, 0),
      bellflower: new THREE.ConeGeometry(.38, .54, 5),
      thorn: new THREE.TetrahedronGeometry(.42, 0),
      glowcap: new THREE.CylinderGeometry(.34, .2, .45, 8)
    };
    const plantAccentGeometries = {
      sunflower: new THREE.IcosahedronGeometry(.2, 1),
      dewcup: new THREE.TorusGeometry(.22, .065, 6, 12),
      mint: new THREE.OctahedronGeometry(.2, 0),
      moonflower: new THREE.TorusGeometry(.24, .055, 6, 16),
      dandelion: new THREE.IcosahedronGeometry(.24, 1),
      bellflower: new THREE.SphereGeometry(.18, 7, 5),
      thorn: new THREE.ConeGeometry(.16, .4, 4),
      glowcap: new THREE.SphereGeometry(.31, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2)
    };
    const plantAccentColors = {
      sunflower: 0xffe18a, dewcup: 0xb9f0e4, mint: 0xd0e4a8, moonflower: 0xf0ddff,
      dandelion: 0xfff2b1, bellflower: 0xe1d4ff, thorn: 0x445f40, glowcap: 0xe9ffb8
    };
    const blightGeometries = {
      dormant: new THREE.OctahedronGeometry(.27, 0),
      creep: new THREE.DodecahedronGeometry(.31, 0),
      windborne: new THREE.TetrahedronGeometry(.36, 0)
    };
    const bloomGeometry = new THREE.TorusGeometry(.46, .055, 6, 20);
    const resourceGeometry = new THREE.OctahedronGeometry(.12, 0);
    const heartRingGeometry = new THREE.TorusGeometry(.56, .045, 6, 20);
    const bloomMaterial = new THREE.MeshBasicMaterial({ color: 0xffdb72, transparent: true, opacity: .9, depthWrite: false });
    const waterMaterial = new THREE.MeshBasicMaterial({ color: 0x75d1ca, transparent: true, opacity: .9, depthWrite: false });
    const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xffdb72, transparent: true, opacity: .9, depthWrite: false });
    const cells = [];

    function cellPosition(x, y, z = .82) {
      return new THREE.Vector3((x - 2) * 1.45, (2 - y) * 1.15, z);
    }

    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        const group = new THREE.Group();
        group.position.set((x - 2) * 1.45, (2 - y) * 1.15, 0);
        const edge = new THREE.Mesh(edgeGeometry, edgeMaterial);
        edge.rotation.x = Math.PI / 2;
        edge.position.z = -.26;
        group.add(edge);
        const soil = new THREE.Mesh(tileGeometry, soilMaterial);
        soil.rotation.x = Math.PI / 2;
        group.add(soil);
        const plant = new THREE.Mesh(plantGeometries.sunflower, new THREE.MeshStandardMaterial({ color: 0x68a66d, roughness: .85, flatShading: true }));
        plant.rotation.x = Math.PI / 2;
        plant.position.z = .55;
        plant.visible = false;
        group.add(plant);
        const plantAccent = new THREE.Mesh(plantAccentGeometries.sunflower, new THREE.MeshStandardMaterial({ color: plantAccentColors.sunflower, emissive: 0x2b1c08, emissiveIntensity: .08, roughness: .72, flatShading: true }));
        plantAccent.rotation.x = Math.PI / 2;
        plantAccent.position.z = .82;
        plantAccent.visible = false;
        group.add(plantAccent);
        const heart = new THREE.Mesh(heartGeometries.balanced, heartMaterial);
        heart.position.z = .55;
        heart.visible = x === 2 && y === 2;
        group.add(heart);
        const heartRing = new THREE.Mesh(heartRingGeometry, new THREE.MeshBasicMaterial({ color: 0xffddb0, transparent: true, opacity: .68, depthWrite: false }));
        heartRing.position.z = .57;
        heartRing.visible = x === 2 && y === 2;
        group.add(heartRing);
        const blight = new THREE.Mesh(blightGeometries.creep, blightMaterial);
        blight.position.z = .45;
        blight.visible = false;
        group.add(blight);
        const bloom = new THREE.Mesh(bloomGeometry, bloomMaterial);
        bloom.position.z = .86;
        bloom.visible = false;
        group.add(bloom);
        const resource = new THREE.Mesh(resourceGeometry, lightMaterial);
        resource.position.set(-.34, .28, .92);
        resource.visible = false;
        group.add(resource);
        root.add(group);
        cells.push({ group, soil, plant, plantAccent, heart, heartRing, blight, bloom, resource, plantType: null, plantStage: null, heartType: null, heartBaseScale: new THREE.Vector3(1, 1, 1), blightBehavior: null, blightBaseScale: new THREE.Vector3(1, 1, 1), pulse: 0, heartPulse: 0 });
      }
    }

    const routeGroup = new THREE.Group();
    routeGroup.position.z = .88;
    root.add(routeGroup);
    const routeMaterial = new THREE.LineDashedMaterial({ color: 0xffdb72, dashSize: .22, gapSize: .13, transparent: true, opacity: .75, depthWrite: false });
    const transferMaterial = new THREE.LineDashedMaterial({ color: 0x75d1ca, dashSize: .16, gapSize: .1, transparent: true, opacity: .72, depthWrite: false });
    const mosswing = new THREE.Group();
    mosswing.name = 'garden-mosswing';
    const mosswingBody = new THREE.Mesh(new THREE.SphereGeometry(.13, 8, 6), new THREE.MeshBasicMaterial({ color: 0x315747 }));
    mosswingBody.scale.set(.75, 1.25, .65);
    const wingGeometry = new THREE.CircleGeometry(.18, 8, 0, Math.PI);
    const wingMaterial = new THREE.MeshBasicMaterial({ color: 0xf4a95f, side: THREE.DoubleSide, transparent: true, opacity: .92 });
    const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    leftWing.position.x = -.13;
    rightWing.position.x = .13;
    rightWing.rotation.y = Math.PI;
    mosswing.add(mosswingBody, leftWing, rightWing);
    mosswing.position.copy(cellPosition(2, 2, 1.12));
    mosswing.visible = false;
    root.add(mosswing);

    root.rotation.x = -.2;
    root.position.set(0, .2, -1);
    let elapsed = 0;
    let state = null;
    let selectedIndex = -1;
    let previousCamera = null;
    let reducedMotion = false;
    let mosswingTarget = cellPosition(2, 2, 1.12);
    let routeLength = 0;
    let baseY = .2;

    function indexFor(x, y) {
      return y * 5 + x;
    }

    function eventRoute(events) {
      const route = [];
      let collecting = false;
      for (const item of events || []) {
        if (item.type === 'pollination-started' && !item.returnFlight && !collecting) {
          collecting = true;
          continue;
        }
        if (!collecting) continue;
        if (item.type === 'mosswing-visited' && !item.returnFlight) route.push({ x: item.x, y: item.y });
        if (item.type === 'chain-completed' && !item.returnFlight) break;
      }
      return route;
    }

    function addLine(points, material) {
      if (points.length < 2) return;
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, material);
      line.computeLineDistances();
      routeGroup.add(line);
    }

    function clearTransient() {
      cells.forEach(visual => {
        visual.bloom.visible = false;
        visual.resource.visible = false;
        visual.pulse = 0;
      });
      while (routeGroup.children.length) {
        const child = routeGroup.children[routeGroup.children.length - 1];
        routeGroup.remove(child);
        child.geometry?.dispose?.();
      }
      routeLength = 0;
      mosswing.visible = false;
      mosswing.position.copy(cellPosition(2, 2, 1.12));
      mosswingTarget = cellPosition(2, 2, 1.12);
    }

    function drawEventPaths(nextState, events) {
      const route = eventRoute(events);
      const transferKeys = new Set();
      const addTransferLine = (fromX, fromY, toX, toY, material, resource) => {
        const id = `${fromX},${fromY}:${toX},${toY}:${resource}`;
        if (transferKeys.has(id)) return;
        transferKeys.add(id);
        addLine([cellPosition(fromX, fromY, .96), cellPosition(toX, toY, .96)], material);
      };
      routeLength = route.length;
      if (route.length) {
        const points = [{ x: 2, y: 2 }, ...route, { x: 2, y: 2 }].map(pos => cellPosition(pos.x, pos.y, 1));
        addLine(points, routeMaterial);
      }
      for (const item of events || []) {
        if (item.type !== 'resource-transferred') continue;
        addTransferLine(item.fromX, item.fromY, item.toX, item.toY, transferMaterial, item.resource);
      }
      for (const item of events || []) {
        if (item.type !== 'resource-added' || typeof item.source !== 'string') continue;
        const source = nextState?.board?.find(cell => cell.plant?.instanceId === item.source);
        if (source) addTransferLine(source.x, source.y, item.x, item.y, item.resource === 'water' ? transferMaterial : routeMaterial, item.resource);
      }
    }

    function markPreview(events) {
      for (const item of events || []) {
        if (!Number.isInteger(item.x) || !Number.isInteger(item.y)) continue;
        const visual = cells[indexFor(item.x, item.y)];
        if (!visual) continue;
        if (item.type === 'plant-bloomed') visual.bloom.visible = true;
        if (item.type === 'resource-added' || item.type === 'resource-transferred') {
          visual.resource.visible = true;
          visual.resource.material = item.resource === 'water' ? waterMaterial : lightMaterial;
        }
      }
    }

    function setVisible(visible) {
      root.visible = visible;
      if (visible) {
        if (!previousCamera) previousCamera = {
          position: camera.position.clone(),
          rotation: camera.rotation.clone(),
          zoom: camera.zoom
        };
        camera.position.set(0, 2.2, 30);
        camera.rotation.set(0, 0, 0);
        camera.zoom = 1;
        camera.updateProjectionMatrix();
      } else if (previousCamera) {
        camera.position.copy(previousCamera.position);
        camera.rotation.copy(previousCamera.rotation);
        camera.zoom = previousCamera.zoom;
        camera.updateProjectionMatrix();
        previousCamera = null;
      }
    }

    function render(nextState, interaction = {}) {
      state = nextState;
      selectedIndex = Number.isInteger(interaction.selectedIndex) ? interaction.selectedIndex : -1;
      cells.forEach((visual, index) => {
        const cell = state?.board?.[index];
        if (!cell) return;
        const selected = index === selectedIndex;
        visual.soil.material.color.setHex(selected ? 0xb6ca86 : 0x87a984);
        visual.group.scale.setScalar(selected ? 1.08 : 1);
        visual.blight.visible = !!cell.blight;
        visual.plant.visible = !!cell.plant;
        visual.plantAccent.visible = !!cell.plant;
        if (cell.x === 2 && cell.y === 2 && visual.heartType !== state.heart.id) {
          visual.heart.geometry = heartGeometries[state.heart.id] || heartGeometries.balanced;
          visual.heart.material.color.setHex(heartColors[state.heart.id] || heartColors.balanced);
          visual.heartRing.material.color.setHex(state.heart.id === 'reservoir' ? 0x9ce7e2 : state.heart.id === 'moon' ? 0xe6d4ff : 0xffddb0);
          visual.heartType = state.heart.id;
        }
        if (cell.x === 2 && cell.y === 2) {
          const healthScale = state.heart.hp <= 1 ? .72 : state.heart.hp < state.heart.maxHp ? .88 : 1;
          visual.heartBaseScale.setScalar(healthScale);
          if (visual.heartPulse === 0) visual.heart.scale.copy(visual.heartBaseScale);
          visual.heartRing.scale.setScalar(state.heart.id === 'reservoir' ? 1.08 : state.heart.id === 'moon' ? .92 : 1);
          visual.heartRing.rotation.z = state.heart.id === 'moon' ? Math.PI / 4 : 0;
        }
        if (cell.blight && visual.blightBehavior !== cell.blight.behavior) {
          visual.blight.geometry = blightGeometries[cell.blight.behavior] || blightGeometries.creep;
          visual.blightBehavior = cell.blight.behavior;
          if (cell.blight.behavior === 'dormant') visual.blightBaseScale.set(.78, .78, .78);
          else if (cell.blight.behavior === 'windborne') visual.blightBaseScale.set(1.08, .7, 1.18);
          else visual.blightBaseScale.set(1.12, .84, .92);
          visual.blight.scale.copy(visual.blightBaseScale);
          visual.blight.rotation.z = cell.blight.behavior === 'windborne' ? Math.PI / 4 : 0;
        }
        if (cell.plant) {
          if (visual.plantType !== cell.plant.type) {
            visual.plant.geometry = plantGeometries[cell.plant.type] || plantGeometries.sunflower;
            visual.plant.material.color.setHex(PLANT_COLORS[cell.plant.type] || 0x68a66d);
            visual.plantAccent.geometry = plantAccentGeometries[cell.plant.type] || plantAccentGeometries.sunflower;
            visual.plantAccent.material.color.setHex(plantAccentColors[cell.plant.type] || 0xd0e4a8);
            visual.plantType = cell.plant.type;
          }
          visual.plant.rotation.z = -(cell.plant.orientation || 0) * Math.PI / 2;
          visual.plantAccent.rotation.z = visual.plant.rotation.z;
          visual.plantAccent.position.set(0, 0, .82);
          const stageScale = cell.plant.stage === 'withered' ? .52 : cell.plant.stage === 'seedling' ? .64 : 1;
          if (cell.plant.type === 'mint') visual.plant.scale.set(.82 * stageScale, 1.05 * stageScale, .82 * stageScale);
          else if (cell.plant.type === 'bellflower') visual.plant.scale.set(1.05 * stageScale, 1.05 * stageScale, 1.05 * stageScale);
          else if (cell.plant.type === 'thorn') visual.plant.scale.set(.9 * stageScale, 1.18 * stageScale, .9 * stageScale);
          else if (cell.plant.type === 'glowcap') visual.plant.scale.set(1.08 * stageScale, .82 * stageScale, 1.08 * stageScale);
          else visual.plant.scale.setScalar(stageScale);
          const accentScale = cell.plant.type === 'sunflower' ? .9 : cell.plant.type === 'glowcap' ? 1.05 : cell.plant.type === 'thorn' ? .78 : 1;
          visual.plantAccent.scale.setScalar(stageScale * accentScale);
          if (cell.plant.type === 'bellflower') visual.plantAccent.position.y = -.14;
          if (cell.plant.type === 'thorn') visual.plantAccent.position.y = .16;
          visual.plantStage = cell.plant.stage;
        } else {
          visual.plantType = null;
          visual.plantStage = null;
        }
      });
    }

    function showPreview(nextState, events) {
      clearTransient();
      render(nextState, { selectedIndex: -1 });
      drawEventPaths(nextState, events);
      markPreview(events);
    }

    function startResolution(nextState, events) {
      clearTransient();
      render(nextState, { selectedIndex: -1 });
      drawEventPaths(nextState, events);
      mosswing.visible = true;
    }

    function applyEvent(item) {
      if (!item) return;
      if (Number.isInteger(item.x) && Number.isInteger(item.y)) {
        const visual = cells[indexFor(item.x, item.y)];
        if (visual) {
          visual.pulse = reducedMotion ? .08 : .38;
          if (item.type === 'plant-bloomed') visual.bloom.visible = true;
          if (item.type === 'resource-added' || item.type === 'resource-transferred') {
            visual.resource.visible = true;
            visual.resource.material = item.resource === 'water' ? waterMaterial : lightMaterial;
          }
          if (item.type === 'blight-spawned' || item.type === 'blight-spread') visual.blight.visible = true;
        }
      }
      if (item.type === 'mosswing-visited') {
        mosswing.visible = true;
        mosswingTarget = cellPosition(item.x, item.y, 1.12);
        if (reducedMotion) mosswing.position.copy(mosswingTarget);
      } else if (item.type === 'chain-completed') {
        mosswingTarget = cellPosition(2, 2, 1.12);
        if (reducedMotion) mosswing.position.copy(mosswingTarget);
      } else if (item.type === 'heart-damaged') {
        cells[indexFor(2, 2)].heartPulse = reducedMotion ? .08 : .65;
      }
    }

    function finishResolution(finalState) {
      render(finalState, { selectedIndex: -1 });
      mosswingTarget = cellPosition(2, 2, 1.12);
      if (reducedMotion) mosswing.position.copy(mosswingTarget);
    }

    function setReducedMotion(value) {
      reducedMotion = !!value;
      if (reducedMotion) mosswing.position.copy(mosswingTarget);
    }

    function update(dt, speed = 1) {
      if (!root.visible) return;
      elapsed += dt;
      cells.forEach((visual, index) => {
        if (visual.heart.visible && !reducedMotion) visual.heart.rotation.z = elapsed * .35;
        if (visual.blight.visible && !reducedMotion) {
          const pulse = 1 + Math.sin(elapsed * 2.2 + index) * .06;
          visual.blight.scale.copy(visual.blightBaseScale).multiplyScalar(pulse);
        }
        if (visual.heartPulse > 0) {
          visual.heartPulse = Math.max(0, visual.heartPulse - dt * speed);
          const pulse = 1 + Math.sin((visual.heartPulse + .04) * 24) * .14;
          visual.heart.scale.setScalar(pulse);
          visual.heart.material.emissiveIntensity = .16 + visual.heartPulse * .75;
          if (visual.heartPulse === 0) {
            visual.heart.scale.copy(visual.heartBaseScale);
            visual.heart.material.emissiveIntensity = .16;
          }
        }
        if (visual.pulse > 0) {
          visual.pulse = Math.max(0, visual.pulse - dt * speed);
          visual.group.scale.setScalar(1 + Math.sin((visual.pulse + .02) * 18) * .05);
          if (visual.pulse === 0) visual.group.scale.setScalar(1);
        }
      });
      if (mosswing.visible && !reducedMotion) mosswing.position.lerp(mosswingTarget, 1 - Math.exp(-10 * dt * speed));
      if (mosswing.visible && !reducedMotion) {
        leftWing.rotation.z = Math.sin(elapsed * 18) * .42;
        rightWing.rotation.z = -Math.sin(elapsed * 18) * .42;
      }
      if (!reducedMotion) cells.forEach((visual, index) => {
        if (visual.plantAccent.visible && visual.plantStage === 'mature') visual.plantAccent.rotation.y = Math.sin(elapsed * 1.1 + index) * .08;
        if (visual.heartRing.visible) visual.heartRing.rotation.y = Math.sin(elapsed * .8) * .12;
      });
      root.position.y = reducedMotion ? baseY : baseY + Math.sin(elapsed * .5) * .025;
    }

    function resize(worldWidth, worldHeight) {
      const compact = worldWidth / worldHeight < .75;
      root.scale.setScalar(compact ? .84 : 1);
      root.position.x = compact ? 0 : -1.9;
      baseY = compact ? 1.2 : .15;
      root.position.y = baseY;
    }

    function destroy() {
      clearTransient();
      scene.remove(root);
      disposeObject(root);
      new Set([...Object.values(heartGeometries), ...Object.values(plantGeometries), ...Object.values(plantAccentGeometries), ...Object.values(blightGeometries), heartRingGeometry]).forEach(geometry => geometry.dispose());
      routeMaterial.dispose();
      transferMaterial.dispose();
      state = null;
    }

    function getDebugState() {
      return Object.freeze({
        visible: root.visible,
        routeLength,
        mosswingVisible: mosswing.visible,
        reducedMotion,
        heartType: state?.heart?.id || null,
        plantTypes: [...new Set(cells.filter(cell => cell.plant.visible).map(cell => cell.plantType).filter(Boolean))],
        blightBehaviors: [...new Set(cells.filter(cell => cell.blight.visible).map(cell => cell.blightBehavior).filter(Boolean))]
      });
    }

    return Object.freeze({ setVisible, render, showPreview, startResolution, applyEvent, finishResolution, clearTransient, setReducedMotion, update, resize, destroy, getDebugState, root });
  }

  globalThis.MosswingGardenView = Object.freeze({ create });
})();
