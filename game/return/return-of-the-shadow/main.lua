--========================================================================
--  THE RETURN OF THE SHADOW
--  Prologo: "La Scalata"
--
--  Cinematic platformer 2D · LÖVE 11.x
--  Tutto (grafica, animazioni, audio) è generato proceduralmente dal
--  codice: nessun asset esterno, nessun riferimento ad opere esistenti.
--
--  Controlli:
--    ← → / A D        muoversi
--    SPAZIO / Z / K   saltare (verso una sporgenza = presa automatica)
--    ↑ / W            scavalcare da appeso · arrampicarsi sulle pareti segnate
--    ↓ / S            scendere in parete · lasciarsi cadere da appeso
--    R                ricominciare      ESC  uscire
--========================================================================

--------------------------------------------------------------- COSTANTI
local VW, VH   = 1280, 720          -- risoluzione virtuale (letterbox)
local GRAV     = 1500
local RUNSPD   = 260
local BEAMSPD  = 118                -- velocità sulle travi strette
local ACC_G    = 1900
local ACC_A    = 950
local FRICT    = 2100
local JUMPV    = 620
local CLIMBSPD = 200      -- velocità di arrampicata su/giù
local ATK_DUR  = 0.42     -- durata del fendente
local DRAW_DUR = 0.55     -- estrazione della spada
local HOLDSTEP = 26       -- passo verticale degli appigli sulla parete (griglia condivisa da grafica e animazione)
local COYOTE   = 0.10
local JBUF     = 0.13

local CINE_TRIGGER_X = 5980         -- inizio cinematica
local CINE_STOP_X    = 6180         -- il protagonista si ferma qui
local CASTLE_X       = 6500         -- centro del castello
local PROM_Y         = 424          -- quota del promontorio finale

-- Palette (tramonto arancio-violaceo, mondo in ombra fredda)
local COL = {
  skyTop  = {0.22, 0.12, 0.36},
  skyMid  = {0.66, 0.28, 0.44},
  skyLow  = {0.99, 0.55, 0.24},
  sun     = {1.00, 0.86, 0.58},
  ridge1  = {0.47, 0.30, 0.46},     -- montagne lontane
  ridge2  = {0.33, 0.21, 0.37},
  ridge3  = {0.21, 0.14, 0.27},
  rock    = {0.145, 0.115, 0.20},   -- piattaforme in primo piano
  rockLit = {0.98, 0.62, 0.34},     -- luce radente del tramonto
  snow    = {0.90, 0.88, 0.97},
  castle  = {0.155, 0.145, 0.24},
  castle2 = {0.115, 0.105, 0.185},
  portal  = {0.07, 0.065, 0.115},
  emblem  = {0.60, 0.82, 0.78},
  skin    = {0.87, 0.64, 0.47},
  shirt   = {0.88, 0.82, 0.67},   -- camicia chiara di lino
  vest    = {0.66, 0.27, 0.15},   -- gilet/mantellina ruggine
  pants   = {0.42, 0.36, 0.23},   -- pantaloni oliva-terra
  boots   = {0.24, 0.18, 0.125},  -- stivali di cuoio scuro
  belt    = {0.32, 0.23, 0.14},
  hair    = {0.13, 0.10, 0.085},
  scarf   = {0.74, 0.31, 0.18},
  title   = {0.94, 0.89, 0.78},
}

--------------------------------------------------------------- UTILITY
local function clamp(v, a, b) if v < a then return a elseif v > b then return b end return v end
local function lerp(a, b, k)  return a + (b - a) * k end
local function smooth(k) k = clamp(k, 0, 1) return k * k * (3 - 2 * k) end
local function mul(c, f, a)   return {c[1]*f, c[2]*f, c[3]*f, a or 1} end
local function setColA(c, a)  love.graphics.setColor(c[1], c[2], c[3], a or c[4] or 1) end

local T = 0                          -- tempo globale
local function gust(off)             -- intensità del vento 0..1 (raffiche lente)
  local t = T + (off or 0)
  return clamp(0.55 + 0.32*math.sin(t*0.23) + 0.18*math.sin(t*0.71 + 1.3), 0, 1)
end

--------------------------------------------------------------- LIVELLO
-- Piattaforme: {x, y, w, h [, beam=trave stretta] [, climbL=parete sinistra scalabile]}
local plats1 = {
  {x=-260, y=1420, w=260, h=980},                       -- muro di contenimento a sinistra
  {x=0,    y=1800, w=760, h=560},                       -- pianoro di partenza
  {x=840,  y=1728, w=220, h=640},
  {x=1140, y=1652, w=190, h=720},
  {x=1520, y=1636, w=330, h=740},                       -- oltre il primo crepaccio
  {x=1920, y=1476, w=260, h=900},                       -- richiede presa sulla sporgenza
  {x=2260, y=1468, w=150, h=16, beam=true},             -- travi di roccia (equilibrio)
  {x=2480, y=1446, w=140, h=16, beam=true},
  {x=2700, y=1424, w=320, h=950},
  {x=3080, y=1044, w=280, h=1330, climbL=true, climbBot=1508}, -- grande parete scalabile
  {x=3420, y=1000, w=230, h=1380},
  {x=3760, y=856,  w=210, h=1520},                      -- seconda presa in salto
  {x=4030, y=846,  w=140, h=16, beam=true},
  {x=4230, y=816,  w=280, h=1560},
  {x=4740, y=796,  w=250, h=1580},                      -- crepaccio largo: salto in corsa
  {x=5060, y=516,  w=300, h=1860, climbL=true, climbBot=880},  -- ultima parete scalabile
  {x=5420, y=470,  w=190, h=1900},
  {x=5680, y=PROM_Y, w=1520, h=1960},                   -- il promontorio del castello
}

local checkpoints1 = {
  {x=160,  y=1800}, {x=1620, y=1636}, {x=2760, y=1424},
  {x=3480, y=1000}, {x=4310, y=816},  {x=5760, y=PROM_Y},
}

-- livello attivo (1 = la scalata, 2 = il castello)
-- Dichiarate qui perche' drawPlats e buildLevel le usano come upvalue
local level = 1
local plats       -- assegnata da initLevel
local checkpoints -- assegnata da initLevel

--------------------------------------------------------------- AUDIO PROCEDURALE
local windSrc, musicSrc
local musicVol, windVol = 0, 0

-- Vento: rumore bianco filtrato + modulazione lenta → raffiche tra le rocce
local function genWind()
  local rate, secs = 22050, 6
  local n  = rate * secs
  local sd = love.sound.newSoundData(n, rate, 16, 1)
  local rng = love.math.newRandomGenerator(7)
  local lo, mid = 0, 0
  for i = 0, n - 1 do
    local t = i / rate
    local x = rng:random() * 2 - 1
    lo  = lo  + 0.045 * (x - lo)                 -- rombo profondo
    mid = mid + 0.180 * (x - mid)                -- soffio
    local m = 0.55 + 0.30*math.sin(2*math.pi*0.13*t) + 0.15*math.sin(2*math.pi*0.047*t + 1.7)
    local s = (lo * 3.1 + mid * 0.8) * m
    local fade = 1                                -- pausa di raffica ai bordi del loop
    if t < 0.4 then fade = t / 0.4 elseif t > secs - 0.4 then fade = (secs - t) / 0.4 end
    sd:setSample(i, clamp(s * fade, -1, 1))
  end
  return sd
end

-- Musica orchestrale lenta (archi sintetici, Re minore) per la title screen
local function genMusic()
  local rate, dur = 22050, 4.0
  local chords = {
    {73.42, 146.83, 174.61, 220.00, 293.66},     -- Rem  (D2 D3 F3 A3 D4)
    {58.27, 116.54, 174.61, 233.08, 293.66},     -- Sib
    {49.00,  98.00, 146.83, 196.00, 233.08},     -- Solm
    {55.00, 110.00, 164.81, 220.00, 277.18},     -- La
  }
  local total = math.floor(rate * dur * #chords)
  local sd = love.sound.newSoundData(total, rate, 16, 1)
  for ci = 1, #chords do
    local notes = chords[ci]
    local base  = math.floor((ci - 1) * dur * rate)
    local nsamp = math.floor(dur * rate)
    for i = 0, nsamp - 1 do
      local t   = i / rate
      local env = math.max(0, math.min(t / 1.4, 1) * math.min((dur - t) / 1.2, 1))
      env = env * env * (3 - 2 * env)
      local s = 0
      for ni, f in ipairs(notes) do
        local a  = (ni == 1) and 0.16 or 0.10
        local ph = 2 * math.pi * t
        s = s + a * 0.5 * (math.sin(ph*f*0.9985) + math.sin(ph*f*1.0015))  -- "sezione d'archi"
        s = s + a * 0.32 * math.sin(ph*f*2.001)
      end
      local idx = base + i
      if idx < total then sd:setSample(idx, clamp(s * env, -1, 1)) end
    end
  end
  return sd
end

--------------------------------------------------------------- SFONDO
local skyTopMesh, skyLowMesh
local ridges = {}
local clouds = {}

local function genRidge(seed, amp, x0, x1, n)
  local rng = love.math.newRandomGenerator(seed)
  local a1, a2, a3 = rng:random()*6.283, rng:random()*6.283, rng:random()*6.283
  local pts = {}
  for i = 0, n do
    local x = x0 + (x1 - x0) * i / n
    local u = i * 0.35
    local h = amp * (0.60 + 0.40 * math.sin(u*0.8 + a1))
            + amp * 0.45 * (1 - math.abs(math.sin(u*1.7 + a2)))
            + amp * 0.18 * math.sin(u*4.1 + a3)
    pts[#pts+1] = x; pts[#pts+1] = -h
  end
  pts[#pts+1] = x1; pts[#pts+1] = 1400
  pts[#pts+1] = x0; pts[#pts+1] = 1400
  return love.math.triangulate(pts)
end

local function buildBackground()
  skyTopMesh = love.graphics.newMesh({
    {0,0,0,0,  COL.skyTop[1],COL.skyTop[2],COL.skyTop[3],1},
    {VW,0,0,0, COL.skyTop[1],COL.skyTop[2],COL.skyTop[3],1},
    {VW,VH*0.55,0,0, COL.skyMid[1],COL.skyMid[2],COL.skyMid[3],1},
    {0,VH*0.55,0,0,  COL.skyMid[1],COL.skyMid[2],COL.skyMid[3],1},
  }, "fan")
  skyLowMesh = love.graphics.newMesh({
    {0,VH*0.55,0,0,  COL.skyMid[1],COL.skyMid[2],COL.skyMid[3],1},
    {VW,VH*0.55,0,0, COL.skyMid[1],COL.skyMid[2],COL.skyMid[3],1},
    {VW,VH,0,0, COL.skyLow[1],COL.skyLow[2],COL.skyLow[3],1},
    {0,VH,0,0,  COL.skyLow[1],COL.skyLow[2],COL.skyLow[3],1},
  }, "fan")
  ridges = {
    {tris = genRidge(11, 250, -600, 8400, 150), par = 0.12, lift = -55, col = COL.ridge1},
    {tris = genRidge(23, 330, -600, 8400, 170), par = 0.30, lift =  15, col = COL.ridge2},
    {tris = genRidge(47, 420, -600, 8400, 190), par = 0.55, lift = 105, col = COL.ridge3},
  }
  local rng = love.math.newRandomGenerator(99)
  for i = 1, 6 do
    clouds[i] = {x = rng:random()*VW, y = VH*(0.18 + rng:random()*0.30),
                 w = 180 + rng:random()*260, h = 10 + rng:random()*16,
                 spd = 4 + rng:random()*8, a = 0.14 + rng:random()*0.16}
  end
end

local function drawBackground(cam)
  love.graphics.setColor(1,1,1)
  love.graphics.draw(skyTopMesh)
  love.graphics.draw(skyLowMesh)

  -- sole basso all'orizzonte
  local sx, sy = VW*0.60, VH*0.55
  for i = 5, 1, -1 do
    setColA(COL.sun, 0.05 * i)
    love.graphics.circle("fill", sx, sy, 42 + (6 - i) * 30)
  end
  setColA(COL.sun, 0.95)
  love.graphics.circle("fill", sx, sy, 40)

  -- veli di nubi violacee
  for _, c in ipairs(clouds) do
    love.graphics.setColor(0.46, 0.23, 0.42, c.a)
    local cx = (c.x - T * c.spd) % (VW + c.w) - c.w * 0.5
    love.graphics.ellipse("fill", cx, c.y, c.w, c.h)
  end

  -- catene montuose in parallasse
  for _, L in ipairs(ridges) do
    love.graphics.push()
    local offY = VH * 0.62 + (1500 - cam.y) * L.par * 0.5 + L.lift
    love.graphics.translate(-cam.x * L.par, offY)
    setColA(L.col)
    for _, tri in ipairs(L.tris) do love.graphics.polygon("fill", tri) end
    love.graphics.pop()
  end

  -- foschia calda sull'orizzonte
  love.graphics.setColor(COL.skyLow[1], COL.skyLow[2], COL.skyLow[3], 0.18)
  love.graphics.rectangle("fill", 0, VH*0.55, VW, VH*0.28)
end

--------------------------------------------------------------- PIATTAFORME
--========================================================= ROCCIA (pixel art)
-- Palette pietra: grigi freddi del crepuscolo, bordo caldo del tramonto
local STONE = {
  base  = {0.335, 0.305, 0.375},
  mid   = {0.265, 0.240, 0.310},
  dark  = {0.160, 0.145, 0.205},
  lit   = {0.475, 0.440, 0.485},
  moss  = {0.30, 0.42, 0.18},
  mossL = {0.50, 0.68, 0.25},
}

-- Profilo frastagliato della rupe, calcolato una volta e messo in cache.
-- I fianchi sporgono verso l'ESTERNO del rettangolo di collisione, così il
-- gameplay non cambia ma la sagoma è quella di una vetta, non di un muro.
local function rockOutline(p, pi)
  if p._tris then return p._tris end
  local rng = love.math.newRandomGenerator(pi * 4211 + 13)
  local pts = {}
  local function push(x, y) pts[#pts+1] = x; pts[#pts+1] = y end

  push(p.x, p.y)                          -- spigolo alto-sinistro
  push(p.x + p.w, p.y)                    -- spigolo alto-destro

  -- fianco destro: dentellato (liscio se scalabile: roccia "lavorata")
  if not p.climbR then
    local y = p.y
    while y < p.y + p.h - 44 do
      y = y + 30 + rng:random() * 42
      push(p.x + p.w + rng:random() * 14, math.min(y, p.y + p.h - 6))
    end
  end
  push(p.x + p.w, p.y + p.h)
  push(p.x, p.y + p.h)

  -- fianco sinistro, dal basso verso l'alto
  if not p.climbL then
    p._leftI = #pts + 1                   -- inizio del profilo sinistro (per la luce)
    local ys = {}
    local y = p.y + p.h
    while y > p.y + 44 do
      y = y - (30 + rng:random() * 42)
      ys[#ys+1] = math.max(y, p.y + 8)
    end
    for _, yy in ipairs(ys) do
      push(p.x - rng:random() * 14, yy)
    end
  end

  local ok, tris = pcall(love.math.triangulate, pts)
  p._tris = ok and tris or {
    {p.x, p.y, p.x + p.w, p.y, p.x + p.w, p.y + p.h},
    {p.x, p.y, p.x + p.w, p.y + p.h, p.x, p.y + p.h},
  }
  p._pts = pts
  return p._tris
end

-- Ciuffi d'erba/muschio "a blocchetti" sul bordo superiore
local function drawGrass(x, y, w, rng)
  love.graphics.setColor(STONE.moss[1]*0.55, STONE.moss[2]*0.55, STONE.moss[3]*0.55, 1)
  love.graphics.rectangle("fill", x, y - 4, w, 5)
  local gx = x + 3
  while gx < x + w - 3 do
    local gh = 4 + math.floor(rng:random() * 6)
    love.graphics.setColor(STONE.moss[1], STONE.moss[2], STONE.moss[3], 1)
    love.graphics.rectangle("fill", gx, y - 4 - gh, 3, gh)
    if rng:random() < 0.55 then
      love.graphics.setColor(STONE.mossL[1], STONE.mossL[2], STONE.mossL[3], 1)
      love.graphics.rectangle("fill", gx, y - 4 - gh, 2, 2)
    end
    gx = gx + 4 + math.floor(rng:random() * 7)
  end
end

-- Parete scalabile: fascia di roccia levigata con appigli scavati a
-- intervalli regolari — si riconosce a colpo d'occhio dal resto della rupe.
local function drawClimbMarks(p, pi)
  local rng = love.math.newRandomGenerator(pi * 557 + 3)
  local x = p.x
  local yEnd = math.min((p.climbBot or (p.y + p.h)) + 30, p.y + p.h - 16)
  -- fascia levigata (più chiara) con solco d'ombra che la separa dalla rupe
  love.graphics.setColor(STONE.lit[1], STONE.lit[2], STONE.lit[3], 0.30)
  love.graphics.rectangle("fill", x, p.y + 4, 18, yEnd - p.y - 4)
  love.graphics.setColor(STONE.dark[1], STONE.dark[2], STONE.dark[3], 0.95)
  love.graphics.rectangle("fill", x + 18, p.y + 4, 2, yEnd - p.y - 4)
  -- appigli: tacca scavata + labbro illuminato, su griglia fissa HOLDSTEP
  local y = p.y + HOLDSTEP
  while y < yEnd - 14 do
    love.graphics.setColor(0, 0, 0, 0.55)
    love.graphics.rectangle("fill", x + 2, y, 13, 4)
    love.graphics.setColor(STONE.lit[1], STONE.lit[2], STONE.lit[3], 0.85)
    love.graphics.rectangle("fill", x + 2, y - 2, 13, 2)
    -- pietra d'appoggio sporgente, ogni tanto
    if rng:random() < 0.35 then
      love.graphics.setColor(STONE.mid[1], STONE.mid[2], STONE.mid[3], 1)
      love.graphics.rectangle("fill", x - 4, y + 9, 5, 6)
      love.graphics.setColor(STONE.lit[1], STONE.lit[2], STONE.lit[3], 0.7)
      love.graphics.rectangle("fill", x - 4, y + 9, 5, 2)
    end
    y = y + HOLDSTEP
  end
end

--==================== LIVELLO 2: MURATURA E SFONDO DEL CASTELLO ====================
local BRICK = {
  base = {0.30, 0.27, 0.30}, dark = {0.165, 0.145, 0.175},
  lit  = {0.42, 0.38, 0.40}, mort = {0.11, 0.10, 0.125},
}

-- muratura a corsi sfalsati (mattoni), con ombra che sale dal basso
local function drawBrickBody(p, pi)
  local rng = love.math.newRandomGenerator(pi * 911 + 17)
  love.graphics.setColor(BRICK.dark[1], BRICK.dark[2], BRICK.dark[3], 1)
  love.graphics.rectangle("fill", p.x, p.y, p.w, p.h)
  local bh, bw = 16, 46
  local hLim = math.min(p.h, 900)
  local row, cy = 0, p.y
  while cy < p.y + hLim do
    local off = (row % 2 == 0) and 0 or bw * 0.5
    local cx = p.x - off
    while cx < p.x + p.w do
      local x0 = math.max(cx, p.x)
      local x1 = math.min(cx + bw - 2, p.x + p.w)
      if x1 > x0 + 3 then
        local v = 0.85 + rng:random() * 0.3
        love.graphics.setColor(BRICK.base[1] * v, BRICK.base[2] * v, BRICK.base[3] * v, 1)
        love.graphics.rectangle("fill", x0, cy + 1, x1 - x0, bh - 2)
        love.graphics.setColor(BRICK.lit[1], BRICK.lit[2], BRICK.lit[3], 0.25)
        love.graphics.rectangle("fill", x0, cy + 1, x1 - x0, 2)
      end
      cx = cx + bw
    end
    love.graphics.setColor(BRICK.mort[1], BRICK.mort[2], BRICK.mort[3], 1)
    love.graphics.rectangle("fill", p.x, cy, p.w, 1.5)
    cy = cy + bh
    row = row + 1
  end
  for k = 1, 3 do
    local sy = p.y + hLim * (0.42 + k * 0.19)
    if sy < p.y + p.h then
      love.graphics.setColor(0, 0, 0, 0.18)
      love.graphics.rectangle("fill", p.x, sy, p.w, p.y + p.h - sy)
    end
  end
end

-- lastricato di pietra sul bordo superiore (pavimenti del castello)
local function drawFlags(x, y, w, rng)
  love.graphics.setColor(BRICK.lit[1], BRICK.lit[2], BRICK.lit[3], 1)
  love.graphics.rectangle("fill", x, y - 3, w, 4)
  love.graphics.setColor(BRICK.mort[1], BRICK.mort[2], BRICK.mort[3], 1)
  local gx = x
  while gx < x + w do
    love.graphics.rectangle("fill", gx, y - 3, 1.5, 4)
    gx = gx + 26 + rng:random() * 14
  end
  love.graphics.setColor(1, 0.85, 0.6, 0.18)
  love.graphics.rectangle("fill", x, y - 3, w, 1.5)
end

-- interno del castello: buio, arcate lontane, spifferi di luce dalle feritoie
local function drawBackground2(cam)
  for i = 0, 16 do
    local k = i / 16
    love.graphics.setColor(0.055 + 0.05 * k, 0.05 + 0.04 * k, 0.085 + 0.055 * k, 1)
    love.graphics.rectangle("fill", 0, VH * k, VW, VH / 16 + 1)
  end
  local par = 0.25
  local ox = (-cam.x * par) % 340
  love.graphics.setColor(0.095, 0.085, 0.135, 1)
  for i = -1, 4 do
    local ax = ox + i * 340
    love.graphics.rectangle("fill", ax, 235, 44, VH)
    love.graphics.rectangle("fill", ax + 296, 235, 44, VH)
    love.graphics.arc("fill", ax + 170, 262, 148, math.pi, 2 * math.pi)
  end
  -- spifferi di luce del crepuscolo dalle feritoie in alto
  love.graphics.setColor(0.75, 0.45, 0.55, 0.045)
  love.graphics.polygon("fill", 330, 0, 400, 0, 560, VH, 430, VH)
  love.graphics.polygon("fill", 880, 0, 935, 0, 1080, VH, 970, VH)
end

local function drawPlats()
  love.graphics.setLineWidth(1)
  for pi, p in ipairs(plats) do
    local rng = love.math.newRandomGenerator(pi * 733 + 5)
    if p.beam then
      -- trave di roccia: lastra compatta con rim light e ciuffi d'erba
      love.graphics.setColor(STONE.mid[1], STONE.mid[2], STONE.mid[3], 1)
      love.graphics.rectangle("fill", p.x, p.y, p.w, p.h)
      love.graphics.setColor(STONE.dark[1], STONE.dark[2], STONE.dark[3], 1)
      love.graphics.rectangle("fill", p.x, p.y + p.h - 3, p.w, 3)
      love.graphics.setColor(COL.rockLit[1], COL.rockLit[2], COL.rockLit[3], 0.7)
      love.graphics.rectangle("fill", p.x + 1, p.y, p.w - 2, 2)
      if level == 1 then drawGrass(p.x, p.y, p.w, rng)
      else drawFlags(p.x, p.y, p.w, rng) end
    elseif level == 2 then
      -- LIVELLO 2: muratura del castello
      drawBrickBody(p, pi)
      if p.climbL then drawClimbMarks(p, pi) end
      love.graphics.setColor(1.0, 0.72, 0.4, 0.30)   -- riflesso caldo delle torce
      love.graphics.rectangle("fill", p.x, p.y, p.w, 2)
      drawFlags(p.x, p.y, p.w, rng)
    else
      -- corpo della rupe (sagoma frastagliata triangolata)
      local tris = rockOutline(p, pi)
      love.graphics.setColor(STONE.base[1], STONE.base[2], STONE.base[3], 1)
      for _, t in ipairs(tris) do love.graphics.polygon("fill", t) end

      local hLim = math.min(p.h, 820)

      -- la rupe affonda nell'ombra della valle: bande scure crescenti
      for k = 1, 4 do
        local sy = p.y + hLim * (0.30 + k * 0.17)
        if sy < p.y + p.h then
          love.graphics.setColor(STONE.dark[1], STONE.dark[2], STONE.dark[3], 0.17)
          love.graphics.rectangle("fill", p.x, sy, p.w, p.y + p.h - sy)
        end
      end

      -- stratificazioni orizzontali (sedimenti)
      for _ = 1, math.max(3, math.floor(hLim / 110)) do
        local sy = p.y + 22 + rng:random() * (hLim - 34)
        love.graphics.setColor(0, 0, 0, 0.22)
        love.graphics.rectangle("fill", p.x + 3, sy, p.w - 6, 2)
        love.graphics.setColor(STONE.lit[1], STONE.lit[2], STONE.lit[3], 0.12)
        love.graphics.rectangle("fill", p.x + 3, sy - 2, p.w - 6, 2)
      end

      -- massi incastonati e chiazze di tono
      for _ = 1, math.max(4, math.floor(p.w * hLim / 22000)) do
        local cx = p.x + 12 + rng:random() * (p.w - 24)
        local cy = p.y + 16 + rng:random() * (hLim - 28)
        local r  = 8 + rng:random() * 22
        if rng:random() < 0.55 then
          love.graphics.setColor(STONE.mid[1], STONE.mid[2], STONE.mid[3], 0.8)
        else
          love.graphics.setColor(STONE.lit[1], STONE.lit[2], STONE.lit[3], 0.16)
        end
        love.graphics.polygon("fill",
          cx - r,      cy + r*0.15, cx - r*0.35, cy - r*0.65,
          cx + r*0.55, cy - r*0.5,  cx + r,      cy + r*0.2,
          cx + r*0.25, cy + r*0.6,  cx - r*0.45, cy + r*0.55)
      end

      -- crepe verticali spezzate
      love.graphics.setColor(0, 0, 0, 0.32)
      love.graphics.setLineWidth(2)
      for _ = 1, math.max(2, math.floor(p.w / 100)) do
        local cx = p.x + 14 + rng:random() * (p.w - 28)
        local cy = p.y + 18 + rng:random() * hLim * 0.6
        for _ = 1, 3 do
          local nx = cx + (rng:random() - 0.5) * 22
          local ny = cy + 16 + rng:random() * 30
          love.graphics.line(cx, cy, nx, ny)
          cx, cy = nx, ny
        end
      end

      -- luce radente del tramonto sul profilo sinistro frastagliato
      if p._pts and p._leftI then
        love.graphics.setColor(COL.rockLit[1], COL.rockLit[2], COL.rockLit[3], 0.30)
        love.graphics.setLineWidth(2)
        local pts = p._pts
        love.graphics.line(pts[#pts-1], pts[#pts], p.x, p.y)
        for i = p._leftI, #pts - 3, 2 do
          love.graphics.line(pts[i], pts[i+1], pts[i+2], pts[i+3])
        end
      end

      -- fascia scalabile con appigli
      if p.climbL then drawClimbMarks(p, pi) end

      -- rim light del tramonto sul bordo superiore
      love.graphics.setColor(COL.rockLit[1], COL.rockLit[2], COL.rockLit[3], 0.6)
      love.graphics.rectangle("fill", p.x, p.y, p.w, 2)

      -- erba/muschio in cima
      drawGrass(p.x, p.y, p.w, rng)

      -- neve in quota
      if p.y < 1050 then
        love.graphics.setColor(COL.snow[1], COL.snow[2], COL.snow[3], 0.9)
        local sx = p.x + 5
        while sx < p.x + p.w - 8 do
          local sw2 = 18 + rng:random() * 34
          love.graphics.rectangle("fill", sx, p.y - 4, math.min(sw2, p.x + p.w - 5 - sx), 4)
          sx = sx + sw2 + 8 + rng:random() * 22
        end
      end
    end
  end
  love.graphics.setLineWidth(1)
end

--------------------------------------------------------------- EMBLEMA DELLA STREGA
-- Emblema arcano originale: anello, tre archi intrecciati,
-- una luna crescente che culla un occhio.
local function drawEmblem(x, y, r, alpha, bg)
  local a = alpha or 1
  local pulse = 0.75 + 0.25 * math.sin(T * 1.3)
  love.graphics.push()
  love.graphics.translate(x, y)

  setColA(COL.emblem, a * 0.9)
  love.graphics.setLineWidth(r * 0.06)
  love.graphics.circle("line", 0, 0, r)
  love.graphics.setLineWidth(r * 0.03)
  love.graphics.circle("line", 0, 0, r * 0.80)

  -- tacche rituali sull'anello
  for k = 0, 7 do
    local an = k * math.pi / 4 + math.pi / 8
    love.graphics.line(math.cos(an)*r*0.86, math.sin(an)*r*0.86,
                       math.cos(an)*r*0.94, math.sin(an)*r*0.94)
  end

  -- tre archi intrecciati
  love.graphics.setLineWidth(r * 0.045)
  for k = 0, 2 do
    local an = -math.pi/2 + k * 2*math.pi/3
    love.graphics.circle("line", math.cos(an)*r*0.32, math.sin(an)*r*0.32, r*0.44)
  end

  -- luna crescente
  setColA(COL.emblem, a * pulse)
  if bg then
    -- versione piena: cerchio "ritagliato" con il colore di fondo
    love.graphics.circle("fill", 0, r * 0.06, r * 0.30)
    setColA(bg, 1)
    love.graphics.circle("fill", r * 0.11, -r * 0.05, r * 0.27)
  else
    -- versione a contorno (per filigrane su sfondi trasparenti)
    love.graphics.setLineWidth(r * 0.05)
    love.graphics.arc("line", "open", 0, r * 0.06, r * 0.30, math.pi * 0.35, math.pi * 1.65)
    love.graphics.arc("line", "open", r * 0.05, 0.0, r * 0.24, math.pi * 0.45, math.pi * 1.55)
  end

  -- l'occhio cullato dalla luna
  setColA(COL.emblem, a * pulse)
  love.graphics.setLineWidth(r * 0.04)
  love.graphics.ellipse("line", 0, -r * 0.10, r * 0.17, r * 0.095)
  love.graphics.circle("fill", 0, -r * 0.10, r * 0.045)

  love.graphics.pop()
  love.graphics.setLineWidth(1)
end

--------------------------------------------------------------- IL CASTELLO
local function tower(cx, base, w, top, col)
  setColA(col)
  love.graphics.polygon("fill", cx - w/2, base, cx - w*0.42, top, cx + w*0.42, top, cx + w/2, base)
  -- cuspide affilata
  love.graphics.polygon("fill", cx - w*0.56, top + 4, cx, top - w*1.35, cx + w*0.56, top + 4)
  -- bordo illuminato dal tramonto (lato sinistro, verso il sole)
  setColA(COL.rockLit, 0.55)
  love.graphics.setLineWidth(2)
  love.graphics.line(cx - w*0.56, top + 4, cx, top - w*1.35)
  love.graphics.line(cx - w/2, base, cx - w*0.42, top)
end

local function archWindow(x, y, w, h)
  -- NB: non imposta il colore — va impostato dal chiamante
  love.graphics.rectangle("fill", x - w/2, y - h + w/2, w, h - w/2)
  love.graphics.arc("fill", x, y - h + w/2, w/2, math.pi, 2*math.pi)
end

local function drawCastle(cx, gy)
  -- basamento di roccia scolpita che si fonde col promontorio
  setColA(mul(COL.castle2, 0.9))
  love.graphics.polygon("fill", cx-330, gy, cx-235, gy-72, cx+245, gy-84, cx+335, gy)

  -- torri arretrate (più scure)
  tower(cx - 30, gy - 60, 84, gy - 470, COL.castle2)
  tower(cx - 205, gy - 55, 58, gy - 360, COL.castle2)
  tower(cx + 195, gy - 60, 62, gy - 385, COL.castle2)

  -- mastio centrale
  setColA(COL.castle)
  love.graphics.polygon("fill", cx-150, gy-60, cx-135, gy-305, cx+135, gy-305, cx+150, gy-60)
  -- merlatura consumata dal vento
  for i = -3, 3 do
    love.graphics.rectangle("fill", cx + i*38 - 11, gy - 322, 22, 20)
  end
  -- torri frontali
  tower(cx - 128, gy - 60, 52, gy - 330, COL.castle)
  tower(cx + 122, gy - 60, 52, gy - 318, COL.castle)

  -- finestre ad arco (buie; una sola arde di luce calda)
  setColA(COL.portal)
  archWindow(cx - 60, gy - 205, 16, 42)
  archWindow(cx,      gy - 235, 18, 48)
  archWindow(cx + 60, gy - 205, 16, 42)
  archWindow(cx - 128, gy - 250, 12, 30)
  archWindow(cx + 122, gy - 240, 12, 30)
  local flick = 0.55 + 0.20 * math.sin(T*7.3) + 0.12 * math.sin(T*13.1)
  love.graphics.setColor(1.0, 0.62, 0.25, flick)
  archWindow(cx, gy - 235, 18, 48)
  love.graphics.setColor(1.0, 0.62, 0.25, flick * 0.25)
  love.graphics.circle("fill", cx, gy - 250, 26)

  -- il grande portale
  setColA(COL.portal)
  local pw, ph = 96, 128
  love.graphics.rectangle("fill", cx - pw/2, gy - 60 - ph + pw/2, pw, ph - pw/2)
  love.graphics.arc("fill", cx, gy - 60 - ph + pw/2, pw/2, math.pi, 2*math.pi)
  setColA(COL.rockLit, 0.35)
  love.graphics.setLineWidth(3)
  love.graphics.arc("line", "open", cx, gy - 60 - ph + pw/2, pw/2 + 3, math.pi, 2*math.pi)
  love.graphics.line(cx - pw/2 - 3, gy - 60 - ph + pw/2, cx - pw/2 - 3, gy - 60)
  love.graphics.line(cx + pw/2 + 3, gy - 60 - ph + pw/2, cx + pw/2 + 3, gy - 60)

  -- il simbolo della strega inciso sul portale
  drawEmblem(cx, gy - 60 - ph * 0.52, 34, 0.9, COL.portal)

  love.graphics.setLineWidth(1)
end

--------------------------------------------------------------- PARTICELLE
local windStreaks, snowFlakes, dusts = {}, {}, {}

local function buildParticles()
  local rng = love.math.newRandomGenerator(5)
  for i = 1, 46 do
    windStreaks[i] = {x = rng:random()*VW, y = rng:random()*VH,
                      spd = 260 + rng:random()*420, len = 40 + rng:random()*90,
                      ph = rng:random()*6.28}
  end
  for i = 1, 70 do
    snowFlakes[i] = {x = rng:random()*VW, y = rng:random()*VH,
                     spd = 40 + rng:random()*90, r = 1 + rng:random()*1.6,
                     ph = rng:random()*6.28}
  end
end

local function spawnDust(x, y, n, pow)
  for _ = 1, n do
    dusts[#dusts+1] = {x = x + (love.math.random()-0.5)*16, y = y - 3,
                       vx = (love.math.random()-0.5)*90*pow - 40,
                       vy = -love.math.random()*70*pow,
                       life = 0.5 + love.math.random()*0.4, t = 0}
  end
end

local function updateParticles(dt)
  local g = gust()
  for _, s in ipairs(windStreaks) do
    s.x = s.x - s.spd * (0.5 + 0.8*g) * dt
    s.y = s.y + math.sin(T*2 + s.ph) * 22 * dt
    if s.x < -s.len then s.x = VW + s.len; s.y = love.math.random()*VH end
  end
  for _, f in ipairs(snowFlakes) do
    f.x = f.x - f.spd * (0.8 + g) * dt * 2.2
    f.y = f.y + (18 + 14*math.sin(T + f.ph)) * dt
    if f.x < -4 then f.x = VW + 4; f.y = love.math.random()*VH end
    if f.y > VH + 4 then f.y = -4 end
  end
  for i = #dusts, 1, -1 do
    local d = dusts[i]
    d.t = d.t + dt
    d.x = d.x + d.vx * dt
    d.y = d.y + d.vy * dt
    d.vy = d.vy + 60 * dt
    if d.t > d.life then table.remove(dusts, i) end
  end
end

local function drawDusts()
  for _, d in ipairs(dusts) do
    local k = 1 - d.t / d.life
    love.graphics.setColor(0.85, 0.75, 0.66, 0.35 * k)
    love.graphics.circle("fill", d.x, d.y, 2 + (1-k)*4)
  end
end

local function drawScreenParticles(altFade)
  local g = gust()
  love.graphics.setLineWidth(1.4)
  for _, s in ipairs(windStreaks) do
    love.graphics.setColor(1, 0.92, 0.82, (0.04 + 0.10*g))
    love.graphics.line(s.x, s.y, s.x + s.len, s.y - 4)
  end
  for _, f in ipairs(snowFlakes) do
    love.graphics.setColor(0.95, 0.94, 1.0, 0.32 * altFade)
    love.graphics.circle("fill", f.x, f.y, f.r)
  end
  love.graphics.setLineWidth(1)
end

--------------------------------------------------------------- PROTAGONISTA
local player
--============================ LIVELLO 2: IL CASTELLO ============================
local plats2 = {
  {x=-60,  y=900, w=1000, h=560},                                -- salone d'ingresso
  {x=1300, y=744, w=660, h=700},                                 -- sala superiore
  {x=2100, y=744, w=430, h=700},                                 -- sala della trappola
  {x=2530, y=384, w=260, h=1060, climbL=true, climbBot=700},     -- parete di mattoni scalabile
  {x=2790, y=384, w=560, h=1420},                                -- corridoio alto A
  {x=3480, y=384, w=760, h=1420},                                -- corridoio alto B (finale)
}
-- scalinata dal salone alla sala superiore
for i = 0, 5 do
  plats2[#plats2+1] = {x = 940 + i * 60, y = 900 - (i + 1) * 26, w = 66, h = 560 + (i + 1) * 26}
end
local checkpoints2 = {
  {x=150, y=900}, {x=1360, y=744}, {x=2160, y=744}, {x=2860, y=384}, {x=3560, y=384},
}


local ledges, faces = {}, {}
local function buildLevel()
  ledges, faces = {}, {}
  for _, p in ipairs(plats) do
    if not p.beam then
      ledges[#ledges+1] = {x = p.x,       y = p.y, side = -1}
      ledges[#ledges+1] = {x = p.x + p.w, y = p.y, side =  1}
      if p.climbL then
        faces[#faces+1] = {x = p.x, ytop = p.y, ybot = p.y + p.h, side = -1, bot = p.climbBot or (p.y + p.h)}
      end
      if p.climbR then
        faces[#faces+1] = {x = p.x + p.w, ytop = p.y, ybot = p.y + p.h, side = 1, bot = p.climbBot or (p.y + p.h)}
      end
    end
  end
end

local respawn = {x = checkpoints1[1].x, y = checkpoints1[1].y}

local scarf = {}
local function resetScarf(x, y)
  scarf = {}
  for i = 1, 9 do scarf[i] = {x = x, y = y, px = x, py = y} end
end

local function newPlayer(x, y)
  return {
    x = x, y = y, vx = 0, vy = 0, facing = 1,
    state = "air", t = 0, runPhase = 0,
    coyote = 0, jbuf = 0, regrab = 0,
    onGround = false, onBeam = false,
    ledge = nil, face = nil,
    mant = nil, landT = 0, prevVy = 0,
    deadFade = 0, dying = false,
    hp = 3, inv = 0, atkT = 0, drawT = 0, hasSword = false,
    iks = {hf = {}, hb = {}, ff = {}, fb = {}},   -- contatti IK (mani/piedi)
    iksState = nil,
  }
end

local function bobOf(p)
  if p.state == "ground" then
    if p.landT > 0 then return 7 end
    if math.abs(p.vx) > 30 then return math.abs(math.sin(p.runPhase)) * 2.2 end
    return math.sin(p.t * 1.6)
  end
  return 0
end

local function neckPos(p)
  return p.x - p.facing * 2, p.y - 49 + bobOf(p)
end

local function updateScarf(dt)
  local p = player
  local nx, ny = neckPos(p)
  local g = gust()
  scarf[1].x, scarf[1].y = nx, ny
  for i = 2, #scarf do
    local n = scarf[i]
    local vx = (n.x - n.px) * 0.92
    local vy = (n.y - n.py) * 0.92
    n.px, n.py = n.x, n.y
    local ax = -(190 + 190*g) * (0.6 + 0.4*math.sin(T*6.3 + i)) - p.vx * 0.9
    local ay = 260 + 60*math.sin(T*4.7 + i*0.8) - p.vy * 0.35
    n.x = n.x + vx + ax * dt * dt * 14
    n.y = n.y + vy + ay * dt * dt * 14
  end
  for _ = 1, 3 do
    for i = 2, #scarf do
      local a, b = scarf[i-1], scarf[i]
      local dx, dy = b.x - a.x, b.y - a.y
      local d = math.sqrt(dx*dx + dy*dy)
      if d > 0.001 then
        local diff = (d - 5.2) / d
        if i == 2 then
          b.x = b.x - dx * diff
          b.y = b.y - dy * diff
        else
          a.x = a.x + dx * diff * 0.5
          a.y = a.y + dy * diff * 0.5
          b.x = b.x - dx * diff * 0.5
          b.y = b.y - dy * diff * 0.5
        end
      end
    end
  end
end

local function drawScarf()
  for i = 2, #scarf do
    local a, b = scarf[i-1], scarf[i]
    local w = 7.2 - (i / #scarf) * 5.0
    setColA(mul(COL.scarf, 1.0 - (i / #scarf) * 0.22), 0.96)
    love.graphics.setLineWidth(w)
    love.graphics.line(a.x, a.y, b.x, b.y)
    love.graphics.circle("fill", b.x, b.y, w * 0.48)
  end
  love.graphics.setLineWidth(1)
end

-- ---- pose procedurali (spirito "rotoscopico": movimenti pieni e pesati)
local function basePose()
  return {bob = 0, lean = 0,
          armF = {0.14, 0.34}, armB = {-0.12, -0.30},
          legF = {0.06, 0.02}, legB = {-0.10, -0.16}}
end

local function mixPose(a, b, k)
  local o = basePose()
  o.bob  = lerp(a.bob,  b.bob,  k)
  o.lean = lerp(a.lean, b.lean, k)
  for _, key in ipairs({"armF","armB","legF","legB"}) do
    o[key] = {lerp(a[key][1], b[key][1], k), lerp(a[key][2], b[key][2], k)}
  end
  return o
end

local function poseHang(t)
  local sw = math.sin(t * 1.7) * 0.06
  local o = basePose()
  o.armF = {math.pi - 0.04, math.pi - 0.02}
  o.armB = {math.pi - 0.30, math.pi - 0.24}
  o.legF = {0.18 + sw, 0.02 + sw}
  o.legB = {-0.06 + sw, -0.34 + sw}
  o.lean = 0.05
  return o
end

local function poseLand()
  local o = basePose()
  o.bob  = 7; o.lean = 0.24
  o.armF = {0.85, 1.45}; o.armB = {-0.55, 0.05}
  o.legF = {0.50, -0.85}; o.legB = {-0.42, -1.30}
  return o
end

-- l'istante dopo la tirata: mani che lasciano il bordo, ginocchio a terra
local function poseVault()
  local o = basePose()
  o.bob  = 7; o.lean = 0.30
  o.armF = {1.05, 1.55}; o.armB = {0.55, 1.10}
  o.legF = {0.95, -1.25}; o.legB = {-0.25, -1.05}
  return o
end

--------------------------------------------------- CONTATTI IK (arrampicata)
-- Sceglie l'appiglio della griglia HOLDSTEP più vicino a wantY, dentro
-- la finestra [loY, hiY] raggiungibile dall'arto.
local function pickHold(F, wantY, loY, hiY)
  local base = F.ytop + HOLDSTEP
  local y = base + math.floor((wantY - base) / HOLDSTEP + 0.5) * HOLDSTEP
  if y < loY then y = y + HOLDSTEP end
  if y > hiY then y = y - HOLDSTEP end
  return clamp(y, base, (F.bot or F.ybot))
end

-- Target di un arto: la X è locale (relativa alla parete, costante), la Y è
-- in coordinate MONDO e viene inseguita dolcemente: così mani e piedi restano
-- "incollati" all'appiglio mentre il corpo si muove, e le riprese verso il
-- prossimo appiglio sono movimenti rapidi ma naturali, non scatti.
local function ikTarget(p, key, lx, wy, snap, rate)
  local s = p.iks[key]
  if snap or s.wy == nil then
    s.lx, s.wy = lx, wy
  else
    local k = math.min(1, love.timer.getDelta() * (rate or 14))
    s.lx = s.lx + (lx - s.lx) * k
    s.wy = s.wy + (wy - s.wy) * k
  end
  return {s.lx, s.wy - p.y}
end

local function poseFor(p)
  local t = p.t
  local o = basePose()
  if p.state ~= "climb" and p.state ~= "hang" then p.iksState = nil end
  if p.state == "ground" then
    if p.landT > 0 then return poseLand() end
    if (p.turnT or 0) > 0 then
      -- VOLTAFACCIA in tre tempi: anticipazione (busto indietro, gamba
      -- avanti puntata che frena) → frame compatto di profilo, dove avviene
      -- lo specchio del facing → spinta di ripartenza nel nuovo verso.
      local u = 1 - p.turnT / (p.turnDur or 0.2)
      local K1 = {bob = 2.6, lean = 0.0,
                  armF = {0.06, 0.18},  armB = {-0.06, -0.18},
                  legF = {0.10, -0.06}, legB = {-0.10, -0.14}}
      if u < 0.5 then
        local K0 = {bob = 1.2, lean = -0.24,
                    armF = {-0.55, -0.85}, armB = {0.62, 1.05},
                    legF = {0.52, 0.30},   legB = {-0.34, -0.52}}
        return mixPose(K0, K1, smooth(u / 0.5))
      else
        local K2 = {bob = 1.4, lean = 0.20,
                    armF = {0.55, 1.00},   armB = {-0.50, -0.75},
                    legF = {-0.30, -0.55}, legB = {0.48, 0.24}}
        return mixPose(K1, K2, smooth((u - 0.5) / 0.5))
      end
    end
    local spd = math.abs(p.vx)
    if spd > 30 then
      local sf = clamp(spd / RUNSPD, 0.35, 1)
      if p.onBeam then
        -- equilibrio: braccia aperte, passi cauti
        local wob = math.sin(t * 3.1) * 0.12
        local s = math.sin(p.runPhase)
        o.armF = {1.48 + wob, 1.62 + wob}
        o.armB = {-1.48 + wob, -1.62 + wob}
        o.legF = {0.38*s, 0.38*s - 0.28}
        o.legB = {-0.38*s, -0.38*s - 0.34}
        o.lean = wob * 0.5
        o.bob  = math.abs(s) * 1.4
      else
        local ph = p.runPhase
        local sF = math.sin(ph)
        local sB = math.sin(ph + math.pi)
        -- coscia ampia; lo stinco si piega quando la gamba passa sotto il corpo
        local kneeF = 0.30 + 0.85 * math.max(0, math.sin(ph - 2.1))
        local kneeB = 0.30 + 0.85 * math.max(0, math.sin(ph + math.pi - 2.1))
        o.legF = {0.88*sF*sf, (0.88*sF - kneeF)*sf}
        o.legB = {0.88*sB*sf, (0.88*sB - kneeB)*sf}
        -- braccia a gomito piegato che pompano in opposizione alle gambe
        local aF, aB = -0.60*sF*sf, -0.60*sB*sf
        o.armF = {aF, aF + 1.15*sf + 0.15}
        o.armB = {aB, aB + 1.15*sf + 0.15}
        -- busto proteso, testa stabile, doppio appoggio nel bob
        o.lean = (0.16 + 0.05*math.abs(sF)) * sf
        o.bob  = math.abs(math.cos(ph)) * 2.4 * sf
      end
    else
      -- respiro d'attesa e lento spostamento di peso da una gamba all'altra
      local br = math.sin(t * 1.6)
      local w  = math.sin(t * 0.45)
      o.bob = br
      o.armF = {0.14 + br*0.015, 0.36}
      o.armB = {-0.12 - br*0.015, -0.32}
      o.legF = {0.06 + 0.04*w, 0.02}
      o.legB = {-0.10 - 0.04*w, -0.16 - 0.05*math.max(0, w)}
      o.lean = 0.03 + 0.02*w
    end
  elseif p.state == "air" then
    local runJump = clamp((math.abs(p.vx) - 60) / (RUNSPD - 60), 0, 1)
    if p.vy < -60 then
      -- ascesa: spaccata se il salto è in corsa (gamba avanti tesa, dietro
      -- raccolta), raccolto compatto se il salto è da fermo
      local split = {bob = 0, lean = 0.18,
                     armF = {1.05, 1.60},  armB = {-1.15, -0.70},
                     legF = {1.05, 0.75},  legB = {-0.85, -1.45}}
      local tuck  = {bob = 0, lean = 0.10,
                     armF = {2.45, 2.85},  armB = {-0.95, -0.45},
                     legF = {0.85, -0.55}, legB = {-0.45, -1.25}}
      return mixPose(tuck, split, runJump)
    else
      -- discesa: le gambe si preparano all'appoggio, le braccia bilanciano
      local fl = math.sin(t * 9) * 0.14
      o.armF = {2.65 + fl, 2.20 + fl}; o.armB = {-2.55 - fl, -2.10 - fl}
      o.legF = {0.55 - 0.25*runJump, 0.10}; o.legB = {-0.35, -0.90}
      o.lean = 0.08 + 0.08 * runJump
    end
  elseif p.state == "hang" then
    if p.ledge then
      -- Lo spigolo afferrato è ESATTAMENTE a (+13, -48) in coordinate locali
      -- (p.x/p.y sono fissati dalla presa). Le mani si posano sullo spigolo,
      -- i piedi si puntellano sulla faccia della parete sotto di esso.
      -- Il corpo oscilla piano, ma i quattro contatti restano piantati.
      local sway = math.sin(t * 1.7)
      local snap = p.iksState ~= "hang"
      o.ik = {
        hip = {-2.5 + sway * 0.7, -24 + math.abs(sway) * 0.4},
        ch  = {-1.0 + sway * 0.4, -40},
        hf  = ikTarget(p, "hf", 14.2, p.y - 49.5, snap),  -- mano sul piano sopra lo spigolo
        hb  = ikTarget(p, "hb", 11.6, p.y - 47.0, snap),  -- dita sul labbro dello spigolo
        ff  = ikTarget(p, "ff", 13.6, p.y - 7,  snap),    -- punta contro la parete
        fb  = ikTarget(p, "fb", 13.6, p.y - 19, snap),
      }
      p.iksState = "hang"
    else
      return poseHang(t)
    end
  elseif p.state == "climb" then
    if p.face then
      -- CICLO DI SCALATA IN QUATTRO TEMPI (la spinta viene dalle GAMBE):
      --   0.00 mano alta cerca la presa successiva  (il corpo resta fermo)
      --   0.25 la mano bassa la raggiunge, il peso passa sulle braccia
      --   0.50 il piede alto sale raccogliendo il ginocchio
      --   0.75 la gamba SPINGE: il corpo si alza, il piede basso segue
      -- La fase avanza solo col movimento reale, e resta congelata da fermo.
      local F = p.face
      local snap = p.iksState ~= "climb"
      local iks = p.iks
      local dir = (p.vy < -8 and 1) or (p.vy > 8 and -1) or 0

      if snap then
        -- disposizione iniziale scaglionata: mani sopra, piedi sotto
        iks.hf.holdY = pickHold(F, p.y - 70, p.y - 80, p.y - 46)
        iks.hb.holdY = iks.hf.holdY + HOLDSTEP
        iks.ff.holdY = pickHold(F, p.y - 14, p.y - 34, p.y - 2)
        iks.fb.holdY = iks.ff.holdY + HOLDSTEP
        p.climbPh = 0
      end

      -- avanzamento della fase: proporzionale alla velocità, mai da fermo
      local prevPh = p.climbPh or 0
      p.climbPh = prevPh + dir * math.abs(p.vy) * love.timer.getDelta() / (HOLDSTEP * 2)
      local ph = p.climbPh

      -- a ogni quarto di ciclo, l'arto di turno molla e riafferra: uno solo
      -- alla volta, e sempre nell'ordine mano-mano-piede-piede
      local function quarter(x) return math.floor(x * 4) end
      if quarter(ph) ~= quarter(prevPh) then
        local q = quarter(ph) % 4
        if dir < 0 then q = (3 - q) % 4 end        -- in discesa l'ordine si inverte
        local step = dir * HOLDSTEP * 2
        if     q == 0 then iks.hf.holdY = iks.hf.holdY - step
        elseif q == 1 then iks.hb.holdY = iks.hb.holdY - step
        elseif q == 2 then iks.ff.holdY = iks.ff.holdY - step
        else               iks.fb.holdY = iks.fb.holdY - step end
      end

      -- il busto accompagna la spinta della gamba: si accosta al muro quando
      -- il ginocchio si carica, si stacca appena la gamba distende
      local sub  = (ph * 4) % 1
      local push = (quarter(ph) % 4 == 3) and math.sin(sub * math.pi) or 0
      local hug  = (quarter(ph) % 4 == 2) and math.sin(sub * math.pi) or 0

      o.ik = {
        hip = {-1.0 + hug * 1.6 - push * 0.8, -33 - push * 1.5},
        ch  = {-0.5 + hug * 1.2 - push * 0.6, -48 - push * 2.2},
        hf  = ikTarget(p, "hf", 15.2, iks.hf.holdY, snap, 22),
        hb  = ikTarget(p, "hb", 13.6, iks.hb.holdY, snap, 22),
        ff  = ikTarget(p, "ff", 14.0 + hug * 1.5, iks.ff.holdY, snap, 19),
        fb  = ikTarget(p, "fb", 13.6, iks.fb.holdY, snap, 19),
      }
      p.iksState = "climb"
    end
  elseif p.state == "mantle" then
    -- USCITA SUL BORDO, in fasi distinte e leggibili:
    -- 1) mani ancora sullo spigolo, tirata (IK: si vede la presa)
    -- 2) il ginocchio anteriore sale sul piano e le mani LASCIANO il bordo
    -- 3) atterra accovacciato   4) si rialza in piedi. Nessun teletrasporto.
    local m, L = p.mant, p.ledge
    local k = m.t / m.dur
    if L and k < 0.44 then
      local u  = smooth(k / 0.44)
      local su = smooth(clamp((k - 0.10) / 0.30, 0, 1))   -- passo del ginocchio
      local fx = p.facing
      local function loc(wx) return (wx - p.x) * fx end
      o.ik = {
        hip = {0.5 + 2.5 * u, -31 + 3 * u},
        ch  = {1.0 + 3.0 * u, -46 + 5 * u},
        -- mani piantate sullo spigolo per tutta la tirata
        hf  = {loc(L.x + fx * 2.5), (L.y - 1.5) - p.y},
        hb  = {loc(L.x - fx * 1.0), (L.y - 0.2) - p.y},
        -- gamba anteriore: dal puntello in parete al piano superiore
        ff  = {loc(L.x + fx * (0.5 + 7.5 * su)), lerp(p.y - 7, L.y - 1, su) - p.y},
        -- gamba posteriore: resta puntellata dov'era (coordinate mondo fisse)
        fb  = {loc(L.x + fx * 0.5), (m.sy - 18) - p.y},
      }
      p.iksState = "mantle"
    elseif k < 0.64 then
      local w = smooth((k - 0.44) / 0.20)
      return mixPose(poseVault(), poseLand(), w)
    elseif k < 0.80 then
      return poseLand()
    else
      local w = smooth((k - 0.80) / 0.20)
      return mixPose(poseLand(), basePose(), w)
    end
  elseif p.state == "cine" then
    local spd = math.abs(p.vx)
    if spd > 20 then
      local ph = p.runPhase
      local s, s2 = math.sin(ph), math.sin(ph + math.pi)
      o.legF = {0.55*s,  0.55*s  - 0.35}
      o.legB = {0.55*s2, 0.55*s2 - 0.40}
      o.armF = {-0.40*s, -0.40*s + 0.55}
      o.armB = {-0.40*s2, -0.40*s2 + 0.55}
      o.bob  = math.abs(s) * 1.5
      o.lean = 0.08
    else
      local br = math.sin(t * 1.2)
      o.bob = br * 0.8
      o.lean = 0.02
    end
  end
  return o
end

-- segmento affusolato pieno (capsula): la base del nuovo look "dipinto"
local function segment(x1, y1, x2, y2, w1, w2, col)
  local dx, dy = x2 - x1, y2 - y1
  local d = math.sqrt(dx*dx + dy*dy)
  setColA(col)
  if d > 0.001 then
    local nx, ny = -dy/d, dx/d
    love.graphics.polygon("fill",
      x1 + nx*w1, y1 + ny*w1, x2 + nx*w2, y2 + ny*w2,
      x2 - nx*w2, y2 - ny*w2, x1 - nx*w1, y1 - ny*w1)
  end
  love.graphics.circle("fill", x1, y1, w1)
  love.graphics.circle("fill", x2, y2, w2)
end

-- gamba: coscia+polpaccio in stoffa oliva, stivale alto con piede
local function drawLeg(ox, oy, a1, a2, shade)
  local k = shade and 0.66 or 1
  local kx, ky = ox + math.sin(a1)*17, oy + math.cos(a1)*17
  local fx, fy = kx + math.sin(a2)*16, ky + math.cos(a2)*16
  segment(ox, oy, kx, ky, 4.8, 3.7, mul(COL.pants, k))          -- coscia
  segment(kx, ky, fx, fy, 3.5, 2.8, mul(COL.pants, k))          -- polpaccio
  -- gambale dello stivale + piede
  local bx, by = lerp(kx, fx, 0.45), lerp(ky, fy, 0.45)
  segment(bx, by, fx, fy, 3.4, 3.0, mul(COL.boots, k))
  segment(fx - 0.5, fy - 0.6, fx + 5.6, fy - 0.2, 2.8, 1.9, mul(COL.boots, k))
  return fx, fy
end

-- braccio: manica di camicia arrotolata, avambraccio e mano di pelle
local function drawArm(ox, oy, a1, a2, shade)
  local k = shade and 0.66 or 1
  local ex, ey = ox + math.sin(a1)*14, oy + math.cos(a1)*14
  local hx, hy = ex + math.sin(a2)*13, ey + math.cos(a2)*13
  segment(ox, oy, ex, ey, 4.0, 3.2, mul(COL.shirt, k))          -- manica
  local rx, ry = lerp(ex, hx, 0.32), lerp(ey, hy, 0.32)
  segment(ex, ey, rx, ry, 3.3, 3.1, mul(COL.shirt, k))          -- risvolto
  segment(rx, ry, hx, hy, 2.5, 2.1, mul(COL.skin, k))           -- avambraccio+mano
  return hx, hy
end

-- IK a due segmenti: dati origine, bersaglio e lunghezze, restituisce gli
-- angoli (a1, a2) nella convenzione di drawArm/drawLeg (x=sin·l, y=cos·l).
-- La piega e' anatomica e diversa per arto: il GOMITO punta sempre verso il
-- basso (mai sopra la spalla), il GINOCCHIO si alza verso la parete.
local function ik2(ox, oy, tx, ty, l1, l2, mode)
  local dx, dy = tx - ox, ty - oy
  local d = math.sqrt(dx*dx + dy*dy)
  d = clamp(d, math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01)
  local phi = math.atan2(dx, dy)
  local cA  = clamp((l1*l1 + d*d - l2*l2) / (2 * l1 * d), -1, 1)
  local A   = math.acos(cA)
  local best1, best2, bestV
  for sgn = -1, 1, 2 do
    local a1 = phi + sgn * A
    local ex, ey = ox + math.sin(a1)*l1, oy + math.cos(a1)*l1
    local a2 = math.atan2(tx - ex, ty - ey)
    local v = (mode == "arm") and ey or ex   -- braccio: gomito piu' in basso
    if not bestV or v > bestV then best1, best2, bestV = a1, a2, v end
  end
  return best1, best2
end

-- Spada (condivisa: mano dell'eroe, scheletri, oggetto a terra)
local function drawSwordAt(x, y, a)
  local bx, by = math.sin(a), math.cos(a)
  local px, py = math.sin(a + math.pi / 2), math.cos(a + math.pi / 2)
  love.graphics.setColor(0.42, 0.32, 0.16, 1)          -- impugnatura
  love.graphics.setLineWidth(3)
  love.graphics.line(x - bx * 4, y - by * 4, x + bx * 2, y + by * 2)
  love.graphics.setColor(0.55, 0.42, 0.20, 1)          -- guardia
  love.graphics.line(x + bx * 2 - px * 4.5, y + by * 2 - py * 4.5,
                     x + bx * 2 + px * 4.5, y + by * 2 + py * 4.5)
  love.graphics.setColor(0.76, 0.78, 0.84, 1)          -- lama
  love.graphics.setLineWidth(3.2)
  love.graphics.line(x + bx * 3, y + by * 3, x + bx * 27, y + by * 27)
  love.graphics.setColor(0.95, 0.97, 1.0, 0.85)
  love.graphics.setLineWidth(1.2)
  love.graphics.line(x + bx * 4, y + by * 4 - 0.8, x + bx * 26, y + by * 26 - 0.8)
  love.graphics.setLineWidth(1)
end

local function drawHeldSword(hx, hy, forearmA)
  drawSwordAt(hx, hy, forearmA + 0.35)
end

local function drawHero(p)
  local o = poseFor(p)
  -- lampeggio durante l'invulnerabilita' dopo un colpo
  if (p.inv or 0) > 0 and not p.dying and math.floor(T * 14) % 2 == 0 then return end
  -- FENDENTE IN QUATTRO FASI (come nei classici cinematici):
  --   caricamento: peso indietro, punta alta e arretrata
  --   affondo:     il braccio si distende, il busto si porta avanti
  --   estensione:  braccio teso, momento di fermo che "legge" il colpo
  --   recupero:    ritorno morbido alla guardia
  if (p.atkT or 0) > 0 and (p.state == "ground" or p.state == "air") then
    local u = 1 - p.atkT / ATK_DUR
    local a1, a2, ln
    if u < 0.28 then                      -- caricamento
      local k = smooth(u / 0.28)
      a1 = lerp(0.12, -1.05, k); a2 = lerp(0.72, -0.62, k)
      ln = lerp(0.02, -0.16, k)
    elseif u < 0.52 then                  -- affondo
      local k = smooth((u - 0.28) / 0.24)
      a1 = lerp(-1.05, 1.32, k); a2 = lerp(-0.62, 1.58, k)
      ln = lerp(-0.16, 0.30, k)
    elseif u < 0.70 then                  -- estensione (fermo leggibile)
      a1, a2, ln = 1.32, 1.58, 0.30
    else                                  -- recupero alla guardia
      local k = smooth((u - 0.70) / 0.30)
      a1 = lerp(1.32, 0.12, k); a2 = lerp(1.58, 0.72, k)
      ln = lerp(0.30, 0.02, k)
    end
    o.armF = {a1, a2}
    o.armB = {-0.30 - ln * 0.8, -0.55 - ln}
    o.lean = (o.lean or 0) + ln
    o.bob  = (o.bob or 0) + ln * 3
  -- estrazione della spada dal fodero, subito dopo averla raccolta
  elseif (p.drawT or 0) > 0 then
    local k = smooth(1 - p.drawT / DRAW_DUR)
    o.armF = {lerp(-0.95, 0.12, k), lerp(1.35, 0.72, k)}
    o.armB = {lerp(0.45, -0.30, k), lerp(0.80, -0.55, k)}
    o.lean = (o.lean or 0) - 0.10 * (1 - k)
  -- guardia: chi ha la spada la tiene pronta, non a penzoloni
  elseif p.hasSword and (p.state == "ground") and math.abs(p.vx) < 30 then
    o.armF = {0.12, 0.72}
    o.armB = {-0.28, -0.50}
  end
  -- ombra a terra
  if p.onGround then
    love.graphics.setColor(0, 0, 0, 0.22)
    love.graphics.ellipse("fill", p.x, p.y + 2, 16, 4)
  end

  love.graphics.push()
  love.graphics.translate(p.x, p.y)
  love.graphics.scale(p.facing, 1)

  local hipX, hipY = o.lean * 3, -33 + o.bob
  local chX,  chY  = o.lean * 8, -49 + o.bob

  -- contatti IK (arrampicata/appeso): mani e piedi risolti sugli appigli
  -- e sugli spigoli REALI, invece degli angoli stimati della posa
  if o.ik then
    hipX, hipY = o.ik.hip[1], o.ik.hip[2]
    chX,  chY  = o.ik.ch[1],  o.ik.ch[2]
    o.legB = {ik2(hipX, hipY, o.ik.fb[1], o.ik.fb[2], 17, 16, "leg")}
    o.legF = {ik2(hipX, hipY, o.ik.ff[1], o.ik.ff[2], 17, 16, "leg")}
    o.armB = {ik2(chX,  chY,  o.ik.hb[1], o.ik.hb[2], 14, 13, "arm")}
    o.armF = {ik2(chX,  chY,  o.ik.hf[1], o.ik.hf[2], 14, 13, "arm")}
  end

  -- arti "dietro" (in ombra)
  drawLeg(hipX, hipY, o.legB[1], o.legB[2], true)
  drawArm(chX,  chY,  o.armB[1], o.armB[2], true)

  -- busto: camicia chiara che si allarga verso le spalle
  setColA(COL.shirt)
  love.graphics.polygon("fill",
    hipX - 5.6, hipY + 1.5,  hipX + 5.6, hipY + 1.5,
    chX  + 7.2, chY  - 2.0,  chX  - 7.2, chY  - 2.0)
  love.graphics.circle("fill", chX, chY - 1.5, 6.8)   -- spalle/petto

  -- gilet ruggine: pannello dorsale e spallina (la sciarpa verlet completa il look)
  setColA(mul(COL.vest, 0.92))
  love.graphics.polygon("fill",
    chX - 7.2, chY - 2.5,  chX - 2.2, chY - 3.5,
    hipX - 1.4, hipY - 0.5, hipX - 5.6, hipY + 1.0)
  love.graphics.circle("fill", chX - 3.4, chY - 5.2, 4.4)  -- spallina
  setColA(mul(COL.vest, 0.70))
  love.graphics.setLineWidth(2.2)
  love.graphics.line(chX + 4.6, chY - 5.5, hipX + 2.2, hipY - 0.5)  -- cinghia frontale

  -- cintura con fibbia
  setColA(COL.belt)
  love.graphics.setLineWidth(4)
  love.graphics.line(hipX - 5.8, hipY - 0.5, hipX + 5.8, hipY - 0.5)
  setColA(COL.shirt, 0.9)
  love.graphics.rectangle("fill", hipX - 1.4, hipY - 2.2, 2.8, 3.4)

  -- collo, testa, viso
  local hX, hY = chX + o.lean * 4, chY - 9.5
  segment(chX, chY - 4, hX, hY + 3, 2.6, 2.2, COL.skin)
  setColA(COL.skin)
  love.graphics.circle("fill", hX, hY, 6.2)
  love.graphics.polygon("fill", hX + 2.5, hY + 1.0, hX + 6.2, hY + 1.8, hX + 3.0, hY + 4.4) -- mento
  -- occhio
  setColA(COL.hair, 0.9)
  love.graphics.circle("fill", hX + 3.4, hY - 0.6, 0.9)

  -- capigliatura piena, scura e scompigliata dal vento
  local g = gust()
  setColA(COL.hair)
  love.graphics.circle("fill", hX - 1.4, hY - 2.8, 6.0)
  love.graphics.circle("fill", hX + 2.4, hY - 4.2, 3.8)          -- ciuffo frontale
  love.graphics.polygon("fill",                                   -- massa sulla nuca
    hX - 5.6, hY - 3.5, hX - 7.0, hY + 2.5, hX - 3.2, hY + 3.0, hX - 2.0, hY - 1.0)
  love.graphics.setLineWidth(2.4)
  for i = 0, 2 do
    local wob = math.sin(T*7 + i*1.9) * 2.4 * (0.5 + g)
    love.graphics.line(hX - 4 - i*1.4, hY - 3.5 + i*1.2,
                       hX - 9 - i*2.4 - g*3.5, hY - 4.0 + i*2.2 + wob)
  end

  -- arti in primo piano
  drawLeg(hipX, hipY, o.legF[1], o.legF[2], false)
  local hfx, hfy = drawArm(chX,  chY,  o.armF[1], o.armF[2], false)
  if p.hasSword and (p.drawT or 0) <= DRAW_DUR * 0.45 then
    -- scia della lama durante l'affondo
    local au = (p.atkT or 0) > 0 and (1 - p.atkT / ATK_DUR) or nil
    if au and au > 0.28 and au < 0.62 then
      local k = (au - 0.28) / 0.34
      love.graphics.setColor(0.95, 0.97, 1.0, 0.28 * (1 - k))
      love.graphics.arc("line", "open", chX, chY, 30,
                        -0.62 + 2.2 * math.max(0, k - 0.25), -0.62 + 2.2 * k)
      love.graphics.setLineWidth(1)
    end
    drawHeldSword(hfx, hfy, o.armF[2])
  end

  love.graphics.pop()
  love.graphics.setLineWidth(1)
end

--------------------------------------------------------------- FISICA
local function overlap(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2)
  return ax1 < bx2 and ax2 > bx1 and ay1 < by2 and ay2 > by1
end

local function moveAndCollide(p, dt)
  -- orizzontale
  p.x = p.x + p.vx * dt
  for _, q in ipairs(plats) do
    if not q.beam then
      if overlap(p.x-12, p.y-56, p.x+12, p.y-2, q.x, q.y, q.x+q.w, q.y+q.h) then
        if p.vx > 0 then p.x = q.x - 12
        elseif p.vx < 0 then p.x = q.x + q.w + 12 end
        p.vx = 0
      end
    end
  end
  -- verticale
  local prevBottom = p.y
  p.y = p.y + p.vy * dt
  p.onGround = false
  p.onBeam = false
  for _, q in ipairs(plats) do
    if q.beam then
      if p.vy >= 0 and prevBottom <= q.y + 2 and p.y >= q.y
         and p.x + 10 > q.x and p.x - 10 < q.x + q.w then
        p.y = q.y; p.vy = 0; p.onGround = true; p.onBeam = true
      end
    else
      if overlap(p.x-12, p.y-56, p.x+12, p.y, q.x, q.y, q.x+q.w, q.y+q.h) then
        if p.vy > 0 and prevBottom <= q.y + 12 then
          p.y = q.y; p.vy = 0; p.onGround = true
        elseif p.vy < 0 then
          p.y = q.y + q.h + 56; p.vy = 0
        end
      end
    end
  end
end

local function tryGrabLedge(p)
  if p.regrab > 0 or p.vy < -140 then return end
  if love.keyboard.isDown("down") or love.keyboard.isDown("s") then return end
  local hy = p.y - 50
  local left  = love.keyboard.isDown("left")  or love.keyboard.isDown("a")
  local right = love.keyboard.isDown("right") or love.keyboard.isDown("d")
  for _, L in ipairs(ledges) do
    if math.abs(L.y - hy) < 22 then
      if L.side == -1 and not left and p.x < L.x + 4 and L.x - p.x < 26 then
        p.state = "hang"; p.ledge = L; p.facing = 1
        p.x = L.x - 13; p.y = L.y + 48
        p.vx, p.vy = 0, 0; p.t = 0
        return
      elseif L.side == 1 and not right and p.x > L.x - 4 and p.x - L.x < 26 then
        p.state = "hang"; p.ledge = L; p.facing = -1
        p.x = L.x + 13; p.y = L.y + 48
        p.vx, p.vy = 0, 0; p.t = 0
        return
      end
    end
  end
end

local function tryGrabWall(p)
  if p.regrab > 0 then return end
  local left  = love.keyboard.isDown("left")  or love.keyboard.isDown("a")
  local right = love.keyboard.isDown("right") or love.keyboard.isDown("d")
  local up    = love.keyboard.isDown("up")    or love.keyboard.isDown("w")
  local down  = love.keyboard.isDown("down")  or love.keyboard.isDown("s")
  for _, F in ipairs(faces) do
    local midY = p.y - 28
    local bot  = F.bot or F.ybot
    if midY > F.ytop + 10 and midY < bot + 34 then
      local dist, toward
      if F.side == -1 then dist = math.abs((p.x + 12) - F.x); toward = right
      else                 dist = math.abs((p.x - 12) - F.x); toward = left end
      -- ↑/↓ vicino alla parete = aggancio automatico e generoso;
      -- in aria basta anche la spinta verso la parete (aggancio classico)
      if ((up or down) and dist < 38) or (toward and dist < 10 and p.state == "air") then
        p.state = "climb"; p.face = F; p.facing = -F.side
        p.x = F.x + F.side * 12.5
        p.vx, p.vy = 0, 0; p.t = 0
        return
      end
    end
  end
end

local function startMantle(p)
  local L = p.ledge
  p.state = "mantle"
  p.mant = {sx = p.x, sy = p.y,
            tx = L.x + (L.side == -1 and 15 or -15), ty = L.y,
            t = 0, dur = 0.95}
  p.t = 0
end

--------------------------------------------------------------- CAMERA & CINEMATICA
local cam  = {x = 0, y = 0, zoom = 1}
local cine = {on = false, stage = 0, t = 0, titleA = 0, subA = 0, boxA = 0, hintA = 0}
local introT = 0
local FONT_HUD, FONT_LOC, FONT_TITLE, FONT_SUB

local function startCine(p)
  cine.on = true; cine.stage = 1; cine.t = 0
  p.state = "cine"; p.vx = 0; p.vy = 0
end

local function updateCine(dt, p)
  cine.t = cine.t + dt
  cine.boxA = math.min(1, cine.boxA + dt * 0.8)
  if cine.stage == 1 then
    p.facing = 1
    p.vx = 128
    p.x = p.x + p.vx * dt
    p.runPhase = p.runPhase + dt * 6.5
    if p.x >= CINE_STOP_X then
      p.x = CINE_STOP_X; p.vx = 0
      cine.stage = 2; cine.t = 0
    end
  elseif cine.stage == 2 then
    p.vx = 0
    if cine.t > 1.3 then
      cine.stage = 3; cine.t = 0
      musicSrc:play()
    end
  elseif cine.stage == 3 then
    if cine.t > 0.9 then
      cine.titleA = math.min(1, cine.titleA + dt / 3.2)
    end
    if cine.titleA >= 1 and cine.t > 5.0 then
      cine.stage = 4; cine.t = 0
    end
  elseif cine.stage == 4 then
    cine.subA  = math.min(1, cine.subA + dt / 1.6)
    if cine.t > 2.2 then cine.hintA = math.min(1, cine.hintA + dt / 1.6) end
  end
end

local function updateCamera(dt, p)
  local tx, ty, tz
  if cine.on and cine.stage >= 2 then
    tx, ty, tz = CASTLE_X - 110, PROM_Y - 238, 0.82
  elseif cine.on then
    tx, ty, tz = p.x + 180, p.y - 170, 0.94
  else
    tx = p.x + p.facing * 70
    ty = p.y - 130
    tz = 1
  end
  local k = math.min(1, dt * (cine.on and 1.1 or 3.4))
  cam.x = lerp(cam.x, tx, k)
  cam.y = lerp(cam.y, ty, k)
  cam.zoom = lerp(cam.zoom, tz, math.min(1, dt * 0.9))
end

--------------------------------------------------------------- UPDATE GIOCATORE
local function killPlayer(p)
  if not p.dying then p.dying = true; p.deadFade = 0 end
end

local function respawnPlayer(p)
  p.x, p.y = respawn.x, respawn.y
  p.vx, p.vy = 0, 0
  p.state = "air"; p.t = 0
  p.ledge, p.face, p.mant = nil, nil, nil
  p.hp, p.inv, p.atkT, p.drawT = 3, 1.2, 0, 0
  resetScarf(neckPos(p))
end

--============================ LIVELLO 2: ENTITA' ============================
local l2 = { skels = {}, trap = nil, button = nil, sword = nil,
             msg = "", msgT = 0, endT = 0 }

local function l2toast(s) l2.msg, l2.msgT = s, 3 end

local function hurtPlayer(p, dir)
  if (p.inv or 0) > 0 or p.dying then return end
  p.hp = (p.hp or 3) - 1
  p.inv = 1.1
  p.vx = dir * 240
  p.vy = -180
  p.state = "air"; p.t = 0
  if p.hp <= 0 then killPlayer(p) end
end

-- quota del pavimento sotto un punto (nil = burrone)
local function floorAt(x, y)
  local best
  for _, p in ipairs(plats) do
    if not p.beam and x >= p.x and x <= p.x + p.w and p.y >= y - 8 then
      if not best or p.y < best then best = p.y end
    end
  end
  return best
end

local function newSkel(x, x0, x1, armed)
  return {x = x, y = 0, vx = 0, vy = 0, dir = 1, t = 0, cool = 0,
          x0 = x0, x1 = x1, state = "patrol", armed = armed,
          phase = love.math.random() * 6}
end

local function initEnts2()
  l2.skels = {
    newSkel(2330, 2170, 2470, true),   -- la sentinella sotto la trappola
    newSkel(3050, 2880, 3300, true),
    newSkel(3700, 3560, 3960, true),
  }
  for _, s in ipairs(l2.skels) do s.y = floorAt(s.x, 0) or 744 end
  l2.trap   = {x = 2360, y0 = 452, y = 452, w = 66, h = 42, state = "armed", t = 0}
  l2.button = {x = 2170, y = 744, w = 44, pressed = false}
  l2.sword  = nil
  l2.msg, l2.msgT, l2.endT = "", 0, 0
end

local function updateSkel(sk, dt, p)
  sk.t = sk.t + dt
  if sk.state == "gone" or sk.state == "pile" then return end
  local g = floorAt(sk.x, sk.y)
  if sk.state == "fall" or not g then
    sk.state = "fall"
    sk.vy = sk.vy + GRAV * dt
    sk.y = sk.y + sk.vy * dt
    sk.x = sk.x + sk.vx * dt
    if sk.y > respawn.y + 900 then sk.state = "gone" end
    return
  end
  sk.y = g
  local dx = p.x - sk.x
  local dy = p.y - sk.y
  local near = math.abs(dx) < 170 and math.abs(dy) < 70 and not p.dying
  if sk.state == "stun" then
    sk.x = sk.x + sk.vx * dt
    sk.vx = sk.vx * (1 - math.min(1, dt * 6))
    if not floorAt(sk.x, sk.y) then sk.state = "fall" return end   -- oltre il bordo!
    if sk.t > 0.55 then sk.state = "patrol"; sk.t = 0 end
  elseif sk.state == "windup" then
    sk.dir = dx >= 0 and 1 or -1
    if sk.t > 0.38 then
      sk.state = "strike"; sk.t = 0
      if math.abs(dx) < 52 and math.abs(dy) < 56 then hurtPlayer(p, sk.dir) end
    end
  elseif sk.state == "strike" then
    if sk.t > 0.22 then sk.state = "patrol"; sk.t = 0; sk.cool = 0.6 end
  else -- pattuglia / inseguimento
    sk.cool = math.max(0, (sk.cool or 0) - dt)
    if near and sk.armed then
      sk.dir = dx >= 0 and 1 or -1
      if math.abs(dx) < 46 and sk.cool <= 0 then
        sk.state = "windup"; sk.t = 0
      elseif math.abs(dx) > 40 then
        local nx = sk.x + sk.dir * 62 * dt
        if floorAt(nx + sk.dir * 12, sk.y) then sk.x = nx end
      end
    else
      sk.x = sk.x + sk.dir * 34 * dt
      if sk.x < sk.x0 then sk.dir = 1 elseif sk.x > sk.x1 then sk.dir = -1 end
      if not floorAt(sk.x + sk.dir * 14, sk.y) then sk.dir = -sk.dir end
    end
  end
end

local function updateEnts2(dt)
  local p = player
  -- pulsante a pressione
  local b, tr = l2.button, l2.trap
  if b and tr then
    local on = p.onGround and math.abs(p.x - b.x) < b.w * 0.5 + 8
               and math.abs(p.y - b.y) < 6
    if on and not b.pressed and tr.state == "armed" then
      b.pressed = true
      tr.state = "falling"; tr.t = 0
    end
    if tr.state == "armed" then b.pressed = on end
  end
  -- trappola: la gabbia precipita
  if tr.state == "falling" then
    tr.t = tr.t + dt
    tr.y = tr.y + 1500 * tr.t * dt
    local floorY = 744
    if tr.y + tr.h >= floorY then
      tr.y = floorY - tr.h
      tr.state = "landed"; tr.t = 0
      spawnDust(tr.x, floorY, 8, 1.2)
      for _, sk in ipairs(l2.skels) do
        if sk.state ~= "pile" and sk.state ~= "gone"
           and math.abs(sk.x - tr.x) < 52 and math.abs(sk.y - floorY) < 10 then
          -- crolla in un mucchio d'ossa (nessuna ferita) e perde la spada
          sk.state = "pile"; sk.armed = false
          l2.sword = {x = sk.x + 34, y = floorY, taken = false}
          l2toast("The skeleton collapsed — take its sword")
        end
      end
    end
  elseif tr.state == "landed" then
    tr.t = tr.t + dt
    -- se ha mancato il bersaglio, l'argano la risolleva: si puo' riprovare
    if not l2.sword and tr.t > 3.0 then
      tr.y = tr.y - 160 * dt
      if tr.y <= tr.y0 then tr.y = tr.y0; tr.state = "armed"; b.pressed = false end
    end
  end
  -- spada raccoglibile
  if l2.sword and not l2.sword.taken then
    if math.abs(p.x - l2.sword.x) < 22 and math.abs(p.y - l2.sword.y) < 30 then
      l2.sword.taken = true
      p.hasSword = true
      p.drawT = DRAW_DUR
      l2toast("Sword acquired — press X to strike")
    end
  end
  -- scheletri
  for _, sk in ipairs(l2.skels) do updateSkel(sk, dt, p) end
  -- fendenti del giocatore: spinta all'indietro, mai ferite
  local au = 1 - (p.atkT or 0) / ATK_DUR
  if (p.atkT or 0) > 0 and au > 0.30 and au < 0.56 then
    for _, sk in ipairs(l2.skels) do
      if sk.state ~= "pile" and sk.state ~= "gone" and sk.state ~= "fall"
         and sk.state ~= "stun" then
        local dx = sk.x - p.x
        if dx * p.facing > 0 and math.abs(dx) < 52 and math.abs(sk.y - p.y) < 60 then
          sk.state = "stun"; sk.t = 0
          sk.vx = p.facing * 260
        end
      end
    end
  end
  -- fine del livello
  if p.x > 4060 and l2.endT == 0 then
    l2.endT = 0.0001
    p.state = "cine"; p.vx = 0
  end
  if l2.endT > 0 then l2.endT = l2.endT + dt end
  l2.msgT = math.max(0, l2.msgT - dt)
end

--------------------------------------------------------------- DISEGNO L2
local BONE = {0.86, 0.83, 0.74}

local function drawSkel(sk)
  if sk.state == "gone" then return end
  love.graphics.push()
  love.graphics.translate(sk.x, sk.y)
  if sk.state == "pile" then
    -- mucchio d'ossa: crollato e stordito, senza ferite
    love.graphics.setColor(BONE[1], BONE[2], BONE[3], 1)
    love.graphics.circle("fill", -10, -7, 5.5)
    love.graphics.setColor(0.1, 0.1, 0.12, 1)
    love.graphics.circle("fill", -11.5, -7.5, 1.3)
    love.graphics.setColor(BONE[1], BONE[2], BONE[3], 1)
    love.graphics.setLineWidth(3)
    love.graphics.line(-2, -3, 14, -6)
    love.graphics.line(0, -8, 12, -2)
    love.graphics.line(4, -12, 16, -12)
    love.graphics.setLineWidth(1)
    love.graphics.pop()
    return
  end
  love.graphics.scale(sk.dir, 1)
  local walk = (sk.state == "patrol") and math.sin(sk.t * 7 + sk.phase) or 0
  local lean = (sk.state == "stun" and -0.35) or (sk.state == "windup" and 0.12) or 0
  -- gambe
  love.graphics.setColor(BONE[1] * 0.75, BONE[2] * 0.75, BONE[3] * 0.75, 1)
  love.graphics.setLineWidth(3)
  love.graphics.line(0, -22, 4 * walk, -11, 2 * walk, 0)
  love.graphics.setColor(BONE[1], BONE[2], BONE[3], 1)
  love.graphics.line(0, -22, -4 * walk, -11, -2 * walk, 0)
  -- bacino, spina, costole
  love.graphics.line(-3, -22, 3, -22)
  love.graphics.line(lean * 4, -22, 2 + lean * 8, -38)
  for i = 0, 2 do
    love.graphics.line(-5 + lean * 7, -35 + i * 3.6, 6 + lean * 7, -35 + i * 3.6)
  end
  -- braccio posteriore
  love.graphics.setColor(BONE[1] * 0.7, BONE[2] * 0.7, BONE[3] * 0.7, 1)
  love.graphics.line(1 + lean * 8, -37, -4 - 3 * walk, -30, -1 - 4 * walk, -24)
  -- teschio
  love.graphics.setColor(BONE[1], BONE[2], BONE[3], 1)
  love.graphics.circle("fill", 3 + lean * 10, -43, 5.4)
  love.graphics.rectangle("fill", 3 + lean * 10, -41, 5.5, 3.4)
  love.graphics.setColor(0.08, 0.08, 0.1, 1)
  love.graphics.circle("fill", 5.5 + lean * 10, -44, 1.4)
  -- braccio anteriore (con la spada se armato)
  love.graphics.setColor(BONE[1], BONE[2], BONE[3], 1)
  love.graphics.setLineWidth(3)
  local aA
  if sk.state == "windup" then
    aA = lerp(0.35, -1.05, smooth(math.min(1, sk.t / 0.38)))   -- carica
  elseif sk.state == "strike" then
    aA = lerp(-1.05, 1.45, smooth(math.min(1, sk.t / 0.14)))   -- affonda
  elseif sk.state == "stun" then
    aA = 1.9                                                    -- respinto
  else
    aA = 0.35 + 0.28 * walk                                     -- guardia
  end
  local ex, ey = 2 + math.sin(aA) * 8, -37 + math.cos(aA) * 8
  local hxx, hyy = ex + math.sin(aA + 0.3) * 8, ey + math.cos(aA + 0.3) * 8
  love.graphics.line(2, -37, ex, ey, hxx, hyy)
  if sk.armed then
    local swA = aA + 0.35
    drawSwordAt(hxx, hyy, swA)
  end
  love.graphics.setLineWidth(1)
  love.graphics.pop()
end

local L2_TORCHES = {{260,812},{700,812},{1420,656},{1820,656},{2210,656},
                    {2470,656},{2900,296},{3250,296},{3620,296},{3980,296}}

local function drawEnts2()
  -- torce a muro con fiamma tremolante
  for _, tc in ipairs(L2_TORCHES) do
    local fl = 0.75 + 0.25 * math.sin(T * 9 + tc[1])
    love.graphics.setColor(0.30, 0.20, 0.12, 1)
    love.graphics.rectangle("fill", tc[1] - 2, tc[2], 4, 16)
    love.graphics.setColor(1.0, 0.62, 0.2, 0.85 * fl)
    love.graphics.circle("fill", tc[1], tc[2] - 4, 5)
    love.graphics.setColor(1.0, 0.85, 0.4, 0.9 * fl)
    love.graphics.circle("fill", tc[1], tc[2] - 5, 2.4)
    love.graphics.setColor(1.0, 0.6, 0.25, 0.05 + 0.04 * fl)
    love.graphics.circle("fill", tc[1], tc[2] - 4, 60)
  end
  -- pulsante a pressione
  local b = l2.button
  if b then
    local h = b.pressed and 2 or 5
    love.graphics.setColor(0.16, 0.14, 0.17, 1)
    love.graphics.rectangle("fill", b.x - b.w / 2 - 4, b.y - 2, b.w + 8, 4)
    love.graphics.setColor(0.62, 0.52, 0.30, 1)
    love.graphics.rectangle("fill", b.x - b.w / 2, b.y - h, b.w, h)
    love.graphics.setColor(1, 0.9, 0.6, 0.5)
    love.graphics.rectangle("fill", b.x - b.w / 2, b.y - h, b.w, 1.5)
  end
  -- trappola sospesa: gabbia con catena
  local tr = l2.trap
  if tr then
    love.graphics.setColor(0.35, 0.33, 0.36, 1)
    love.graphics.setLineWidth(2)
    for cy = 40, tr.y - 8, 10 do
      love.graphics.rectangle("line", tr.x - 2, cy, 4, 8)
    end
    love.graphics.setColor(0.24, 0.20, 0.16, 1)
    love.graphics.rectangle("fill", tr.x - tr.w / 2, tr.y, tr.w, tr.h)
    love.graphics.setColor(0.5, 0.42, 0.3, 1)
    love.graphics.setLineWidth(2.5)
    for i = 0, 4 do
      local gx = tr.x - tr.w / 2 + 4 + i * (tr.w - 8) / 4
      love.graphics.line(gx, tr.y + 2, gx, tr.y + tr.h - 2)
    end
    love.graphics.rectangle("line", tr.x - tr.w / 2, tr.y, tr.w, tr.h)
    love.graphics.setLineWidth(1)
  end
  -- spada a terra, con un luccichio
  if l2.sword and not l2.sword.taken then
    local g = 0.6 + 0.4 * math.sin(T * 4)
    drawSwordAt(l2.sword.x, l2.sword.y - 4, -1.1)
    love.graphics.setColor(1, 1, 0.9, 0.25 * g)
    love.graphics.circle("fill", l2.sword.x + 8, l2.sword.y - 14, 12)
  end
  -- scheletri
  for _, sk in ipairs(l2.skels) do drawSkel(sk) end
  -- portale finale con l'emblema della strega
  love.graphics.setColor(0.10, 0.09, 0.13, 1)
  love.graphics.rectangle("fill", 4100, 384 - 150, 90, 150)
  love.graphics.setColor(0.16, 0.14, 0.20, 1)
  love.graphics.rectangle("fill", 4108, 384 - 142, 74, 142)
  drawEmblem(4145, 384 - 78, 26, 0.8, {0.16, 0.14, 0.20})
end

--============================ GESTIONE LIVELLI ============================
function initLevel(n)              -- usata anche da love.keypressed (R / INVIO)
  level = n
  if n == 1 then plats, checkpoints = plats1, checkpoints1
  else plats, checkpoints = plats2, checkpoints2 end
  buildLevel()
  respawn = {x = checkpoints[1].x, y = checkpoints[1].y}
  cine.on, cine.stage, cine.t = false, 0, 0
  cine.titleA, cine.subA, cine.boxA, cine.hintA = 0, 0, 0, 0
  musicVol = 0
  if musicSrc then
    musicSrc:stop(); musicSrc:setVolume(0)
    if n == 2 then musicSrc:play() end
  end
  if n == 2 then initEnts2() end
  player = newPlayer(checkpoints[1].x, checkpoints[1].y - 4)
  resetScarf(neckPos(player))
  cam.x, cam.y, cam.zoom = player.x + 70, player.y - 130, 1
  introT = 0
end

local function updatePlayer(dt, p)
  p.t = p.t + dt
  p.regrab = math.max(0, p.regrab - dt)
  p.jbuf   = math.max(0, p.jbuf - dt)
  p.coyote = math.max(0, p.coyote - dt)
  p.landT  = math.max(0, p.landT - dt)
  p.atkT   = math.max(-1, (p.atkT or 0) - dt)
  p.drawT  = math.max(0, (p.drawT or 0) - dt)
  p.inv    = math.max(0, (p.inv or 0) - dt)

  if p.dying then
    p.deadFade = p.deadFade + dt * 1.6
    if p.deadFade >= 1 then
      respawnPlayer(p)
      p.dying = false; p.deadFade = 0.999
    end
    if not p.dying then return end
    -- durante la dissolvenza continua a cadere
  end
  if p.deadFade > 0 and not p.dying then
    p.deadFade = math.max(0, p.deadFade - dt * 1.4)
  end

  if p.state == "cine" then
    updateCine(dt, p)
    return
  end

  local left  = love.keyboard.isDown("left")  or love.keyboard.isDown("a")
  local right = love.keyboard.isDown("right") or love.keyboard.isDown("d")
  local up    = love.keyboard.isDown("up")    or love.keyboard.isDown("w")
  local down  = love.keyboard.isDown("down")  or love.keyboard.isDown("s")
  local dir   = (right and 1 or 0) - (left and 1 or 0)

  if p.state == "ground" or p.state == "air" then
    -- l'arrampicata ha priorità sul salto: ↑/↓ accanto a una parete
    -- scalabile aggancia subito, senza far partire il salto
    if up or down then
      tryGrabWall(p)
      if p.state == "climb" then p.jbuf = 0; return end
    end
    -- corsa / aria
    local max = p.onBeam and BEAMSPD or RUNSPD
    if p.landT > 0 then dir = 0 end

    -- GIRAVOLTA: invertire direzione a terra innesca il gesto di voltafaccia
    -- (breve, con controllo bloccato). Il facing si ribalta a metà, sul
    -- frame compatto "di profilo", dove lo specchio della sagoma è invisibile.
    p.turnT = math.max(0, (p.turnT or 0) - dt)
    if p.state == "ground" and p.landT <= 0 and p.turnT <= 0
       and dir ~= 0 and dir ~= p.facing and (p.atkT or 0) <= 0 then
      p.turnDur  = (math.abs(p.vx) > 90) and 0.22 or 0.15
      p.turnT    = p.turnDur
      p.turnFlip = false
      if math.abs(p.vx) > 120 then spawnDust(p.x, p.y, 3, 0.7) end   -- slittata
    end
    if p.turnT > 0 and p.state == "ground" then
      dir = 0                                   -- niente input durante il gesto
      -- frenata a slittata più decisa della semplice frizione
      if p.vx > 0 then p.vx = math.max(0, p.vx - 300 * dt)
      else p.vx = math.min(0, p.vx + 300 * dt) end
      if not p.turnFlip and p.turnT <= p.turnDur * 0.5 then
        p.facing = -p.facing
        p.turnFlip = true
      end
    end

    if dir ~= 0 then
      local acc = p.onGround and ACC_G or ACC_A
      p.vx = clamp(p.vx + dir * acc * dt, -max, max)
      p.facing = dir
    else
      local fr = (p.onGround and FRICT or 300) * dt
      if p.vx > 0 then p.vx = math.max(0, p.vx - fr)
      else p.vx = math.min(0, p.vx + fr) end
    end
    if math.abs(p.vx) > 20 then
      p.runPhase = p.runPhase + math.abs(p.vx) * dt * 0.048
    end

    p.vy = math.min(p.vy + GRAV * dt, 1400)
    p.prevVy = p.vy
    moveAndCollide(p, dt)

    if p.onGround then
      if p.state == "air" then
        -- atterraggio
        if p.prevVy > 560 then
          p.landT = 0.26
          spawnDust(p.x, p.y, 6, 1)
        end
        p.t = 0
      end
      p.state = "ground"
      p.coyote = COYOTE
    else
      p.state = "air"
    end

    -- salto (con buffer e coyote-time)
    if p.jbuf > 0 and p.coyote > 0 and p.landT <= 0 then
      p.vy = -JUMPV
      p.jbuf, p.coyote = 0, 0
      p.state = "air"; p.t = 0
      spawnDust(p.x, p.y, 3, 0.6)
    end

    if p.state == "air" then
      tryGrabLedge(p)
      if p.state == "air" then tryGrabWall(p) end
    end

  elseif p.state == "hang" then
    local L = p.ledge
    if up or p.jbuf > 0 then
      p.jbuf = 0
      startMantle(p)
    elseif down then
      p.state = "air"; p.regrab = 0.35; p.vy = 40; p.t = 0
    elseif (L.side == -1 and left) or (L.side == 1 and right) then
      p.state = "air"; p.regrab = 0.35
      p.vx = -L.side * 60; p.vy = 0; p.t = 0
    end

  elseif p.state == "climb" then
    local F = p.face
    if up then p.vy = -CLIMBSPD
    elseif down then p.vy = CLIMBSPD
    else p.vy = 0 end
    p.y = p.y + p.vy * dt
    p.runPhase = p.runPhase + math.abs(p.vy) * dt * 0.035
    -- raggiunta la cima: passa alla presa sulla sporgenza
    if p.y - 50 <= F.ytop + 6 then
      p.ledge = {x = F.x, y = F.ytop, side = F.side}
      p.x = F.x + (F.side == -1 and -13 or 13)
      p.y = F.ytop + 48
      if up then startMantle(p) else p.state = "hang"; p.t = 0 end
    elseif p.y - 20 >= (F.bot or F.ybot) then
      p.y = (F.bot or F.ybot) + 20    -- base della via: resta aggrappato
      p.vy = 0
    elseif p.jbuf > 0 then
      -- balzo di spinta lontano dalla parete
      p.jbuf = 0
      p.state = "air"; p.regrab = 0.35; p.t = 0
      p.vx = F.side * 250
      p.vy = -500
      p.facing = F.side
    elseif (F.side == -1 and left) or (F.side == 1 and right) then
      p.state = "air"; p.regrab = 0.3; p.t = 0
    end

  elseif p.state == "mantle" then
    local m = p.mant
    m.t = math.min(m.dur, m.t + dt)
    local k  = m.t / m.dur
    -- fase 1 (0-0.45): tirata verticale con le mani sullo spigolo
    -- fase 2 (0.28-0.64): il corpo passa sopra il bordo
    -- poi: accovacciato fermo, e infine si rialza (input bloccato fino alla fine)
    local ky = smooth(clamp(k / 0.58, 0, 1))
    local kx = smooth(clamp((k - 0.28) / 0.36, 0, 1))
    p.y = lerp(m.sy, m.ty, ky)
    p.x = lerp(m.sx, m.tx, kx)
    if k >= 1 then
      p.state = "ground"; p.onGround = true; p.t = 0
      p.vx, p.vy = 0, 0
      spawnDust(p.x, p.y, 3, 0.5)
    end
  end

  -- checkpoint
  if p.onGround then
    for _, c in ipairs(checkpoints) do
      if p.x > c.x and c.y <= respawn.y and c.x >= respawn.x then
        if c.x ~= respawn.x then respawn = {x = c.x, y = c.y} end
      end
    end
  end

  -- caduta nel crepaccio
  if p.y > respawn.y + 720 then killPlayer(p) end

  -- limite sinistro del mondo
  if p.x < 14 then p.x = 14; p.vx = math.max(0, p.vx) end

  -- innesco della cinematica finale
  if level == 1 and not cine.on and p.onGround and p.x > CINE_TRIGGER_X then
    startCine(p)
  end
end

--------------------------------------------------------------- TITLE SCREEN
local utf8 = require("utf8")

-- spezza una stringa in caratteri UTF-8 (gestisce ·, lettere accentate, ecc.)
local function utf8chars(text)
  local chars = {}
  for _, cp in utf8.codes(text) do
    chars[#chars + 1] = utf8.char(cp)
  end
  return chars
end

local function printSpaced(text, cx, y, font, spacing, scale)
  local chars = utf8chars(text)
  local total = 0
  for i = 1, #chars do
    total = total + font:getWidth(chars[i]) + spacing
  end
  total = (total - spacing) * scale
  local x = cx - total / 2
  for i = 1, #chars do
    local ch = chars[i]
    love.graphics.print(ch, x, y, 0, scale, scale)
    x = x + (font:getWidth(ch) + spacing) * scale
  end
end

local function drawTitle()
  if cine.titleA <= 0 then return end
  local a = smooth(cine.titleA)
  local scale = 0.94 + 0.06 * a

  -- emblema in filigrana dietro al titolo
  drawEmblem(VW/2, VH*0.34, 150, a * 0.10, nil)

  love.graphics.setFont(FONT_TITLE)
  local y = VH * 0.26
  -- alone tenue
  for _, off in ipairs({{-2,0},{2,0},{0,-2},{0,2},{0,0}}) do
    if off[1] == 0 and off[2] == 0 then
      setColA(COL.title, a)
    else
      love.graphics.setColor(1, 0.85, 0.55, a * 0.10)
    end
    printSpaced("THE RETURN OF THE SHADOW", VW/2 + off[1], y + off[2], FONT_TITLE, 13, scale)
  end

  if cine.subA > 0 then
    love.graphics.setFont(FONT_SUB)
    love.graphics.setColor(0.88, 0.80, 0.72, smooth(cine.subA) * 0.9)
    printSpaced("PROLOGUE  ·  THE ASCENT", VW/2, y + 92, FONT_SUB, 6, 1)
  end
  if cine.hintA > 0 then
    love.graphics.setFont(FONT_HUD)
    love.graphics.setColor(0.9, 0.85, 0.8, smooth(cine.hintA) * (0.55 + 0.25*math.sin(T*2)))
    local msg = "Press R to relive the ascent"
    love.graphics.print(msg, VW/2 - FONT_HUD:getWidth(msg)/2, VH - 74)
    local msg2 = "Press ENTER to enter the castle"
    love.graphics.setColor(0.9, 0.85, 0.8, smooth(cine.hintA))
    love.graphics.print(msg2, VW/2 - FONT_HUD:getWidth(msg2)/2, VH - 50)
  end
end

--------------------------------------------------------------- HUD / OVERLAY
local function drawOverlays()
  -- dissolvenza iniziale + morte
  local black = math.max(1 - math.min(introT / 1.8, 1), player.deadFade)
  if black > 0 then
    love.graphics.setColor(0, 0, 0, black)
    love.graphics.rectangle("fill", 0, 0, VW, VH)
  end

  -- didascalia d'apertura
  local locA = 0
  if introT > 0.8 and introT < 5.2 then
    locA = math.min((introT - 0.8) / 1.2, 1) * math.min((5.2 - introT) / 1.0, 1)
  end
  if locA > 0 then
    love.graphics.setFont(FONT_LOC)
    love.graphics.setColor(0.94, 0.90, 0.84, locA)
    printSpaced(level == 1 and "NORTHERN PEAKS  ·  DUSK"
                or "THE WITCH'S KEEP  ·  INNER HALLS", VW/2, VH*0.16, FONT_LOC, 5, 1)
  end

  -- suggerimenti comandi
  local hintA = 0
  if introT > 2.5 and introT < 11 then
    hintA = math.min((introT - 2.5) / 1.2, 1) * math.min((11 - introT) / 1.5, 1)
  end
  if hintA > 0 and not cine.on then
    love.graphics.setFont(FONT_HUD)
    love.graphics.setColor(0.92, 0.88, 0.82, hintA * 0.85)
    local msg = "< >  move      SPACE  jump      UP / DOWN  climb marked walls      DOWN  let go"
    love.graphics.print(msg, VW/2 - FONT_HUD:getWidth(msg)/2, VH - 52)
  end

  -- LIVELLO 2: cuori, messaggi ed epilogo
  if level == 2 then
    love.graphics.setFont(FONT_HUD)
    for i = 1, 3 do
      local hx, hy = 30 + (i - 1) * 36, 32
      local full = (player.hp or 0) >= i
      if full then love.graphics.setColor(0.85, 0.16, 0.22, 1)
      else love.graphics.setColor(0.25, 0.10, 0.13, 0.8) end
      love.graphics.circle("fill", hx - 5, hy - 3, 6.5)
      love.graphics.circle("fill", hx + 5, hy - 3, 6.5)
      love.graphics.polygon("fill", hx - 11, hy - 0.5, hx + 11, hy - 0.5, hx, hy + 12)
      love.graphics.setColor(1, 1, 1, full and 0.35 or 0.12)
      love.graphics.circle("fill", hx - 6.5, hy - 5, 2)
    end
    if l2.msgT > 0 then
      love.graphics.setColor(0.94, 0.89, 0.78, math.min(1, l2.msgT))
      love.graphics.print(l2.msg, VW/2 - FONT_HUD:getWidth(l2.msg)/2, VH - 96)
    end
    if l2.endT > 0 then
      local a = clamp((l2.endT - 0.4) / 1.6, 0, 1)
      love.graphics.setColor(0, 0, 0, a * 0.9)
      love.graphics.rectangle("fill", 0, 0, VW, VH)
      love.graphics.setFont(FONT_SUB)
      love.graphics.setColor(0.94, 0.89, 0.78, a)
      printSpaced("TO  BE  CONTINUED", VW/2, VH/2 - 12, FONT_SUB, 6, 1)
    end
  end

  -- bande cinematografiche
  if cine.boxA > 0 then
    local h = 58 * smooth(cine.boxA)
    love.graphics.setColor(0.02, 0.015, 0.04, 0.96)
    love.graphics.rectangle("fill", 0, 0, VW, h)
    love.graphics.rectangle("fill", 0, VH - h, VW, h)
  end

  drawTitle()

  -- vignettatura leggera
  love.graphics.setColor(0, 0, 0, 0.16)
  love.graphics.rectangle("fill", 0, 0, VW, 26)
  love.graphics.rectangle("fill", 0, VH - 26, VW, 26)
end

--------------------------------------------------------------- LOVE CALLBACKS
local PIX = 2          -- grana pixel-art: il mondo è reso a (1280/PIX)x(720/PIX)
local pixCanvas        -- e poi ingrandito a blocchi (nearest neighbor)

function love.load()
  love.graphics.setDefaultFilter("nearest", "nearest")
  love.graphics.setLineStyle("rough")
  pixCanvas = love.graphics.newCanvas(VW / PIX, VH / PIX)
  pixCanvas:setFilter("nearest", "nearest")

  -- Livello esterno: se accanto a main.lua (o nella save directory) c'è un
  -- level.lua salvato con l'editor, sostituisce piattaforme e checkpoint.
  if love.filesystem.getInfo("level.lua") then
    local ok, chunk = pcall(love.filesystem.load, "level.lua")
    if ok and chunk then
      local ok2, data = pcall(chunk)
      if ok2 and type(data) == "table" and type(data.plats) == "table" and #data.plats > 0 then
        plats1 = data.plats
        if type(data.checkpoints) == "table" and #data.checkpoints > 0 then
          checkpoints1 = data.checkpoints
        end
      end
    end
  end
  if love.filesystem.getInfo("level2.lua") then
    local ok, chunk = pcall(love.filesystem.load, "level2.lua")
    if ok and chunk then
      local ok2, data = pcall(chunk)
      if ok2 and type(data) == "table" and type(data.plats) == "table" and #data.plats > 0 then
        plats2 = data.plats
        if type(data.checkpoints) == "table" and #data.checkpoints > 0 then
          checkpoints2 = data.checkpoints
        end
      end
    end
  end

  buildBackground()
  buildParticles()

  windSrc  = love.audio.newSource(genWind(), "static")
  windSrc:setLooping(true)
  windSrc:setVolume(0)
  windSrc:play()

  musicSrc = love.audio.newSource(genMusic(), "static")
  musicSrc:setLooping(true)
  musicSrc:setVolume(0)

  FONT_HUD = love.graphics.newFont(15)
  FONT_LOC = love.graphics.newFont(22)
  FONT_SUB = love.graphics.newFont(19)
  local ok, f = pcall(love.graphics.newFont, "assets/title.ttf", 58)
  FONT_TITLE = ok and f or love.graphics.newFont(52)

  initLevel(1)
end

function love.update(dt)
  dt = math.min(dt, 1/30)
  T = T + dt

  introT = introT + dt

  updatePlayer(dt, player)
  updateScarf(dt)
  updateParticles(dt)
  updateCamera(dt, player)

  if level == 2 then updateEnts2(dt) end

  -- audio per livello: fuori il vento, dentro il castello un tema sommesso
  if level == 1 then
    local target = 0.55 * (0.55 + 0.45 * gust())
    if cine.on and cine.stage >= 2 then target = 0.16 end
    windVol = lerp(windVol, target, math.min(1, dt * 1.5))
    windSrc:setVolume(windVol)
    windSrc:setPitch(0.9 + 0.22 * gust(1.7))
    if cine.on and cine.stage >= 3 then
      musicVol = math.min(0.85, musicVol + dt * 0.20)
      musicSrc:setVolume(musicVol)
    end
  else
    windVol = lerp(windVol, 0, math.min(1, dt * 2.5))
    windSrc:setVolume(windVol)
    musicVol = lerp(musicVol, 0.36, math.min(1, dt * 0.6))
    musicSrc:setVolume(musicVol)
  end
end

function love.draw()
  local W, H = love.graphics.getDimensions()
  local S = math.min(W / VW, H / VH)
  local ox, oy = (W - VW * S) / 2, (H - VH * S) / 2

  -- 1) il mondo è reso su un canvas a bassa risoluzione: pixel art anni '90
  love.graphics.setCanvas(pixCanvas)
  love.graphics.clear(0, 0, 0, 1)
  love.graphics.push()
  love.graphics.scale(1 / PIX)

  if level == 1 then drawBackground(cam) else drawBackground2(cam) end

  -- mondo di gioco
  love.graphics.push()
  love.graphics.translate(VW / 2, VH / 2)
  love.graphics.scale(cam.zoom)
  love.graphics.translate(-cam.x, -cam.y)

  if level == 1 then drawCastle(CASTLE_X, PROM_Y) end
  drawPlats()
  if level == 2 then drawEnts2() end
  drawDusts()
  drawScarf()
  drawHero(player)

  love.graphics.pop()

  -- particelle atmosferiche in primo piano (solo all'aperto, livello 1)
  if level == 1 then
    local altFade = clamp((1250 - cam.y) / 500, 0, 1)   -- neve solo in quota
    drawScreenParticles(altFade)
  end

  love.graphics.pop()
  love.graphics.setCanvas()

  -- 2) upscale a blocchi (nearest) sulla finestra, con letterbox
  love.graphics.push()
  love.graphics.translate(ox, oy)
  love.graphics.scale(S)
  love.graphics.setScissor(ox, oy, VW * S, VH * S)
  love.graphics.setColor(1, 1, 1, 1)
  love.graphics.draw(pixCanvas, 0, 0, 0, PIX, PIX)

  -- 3) testi e overlay cinematografici a piena risoluzione (nitidi)
  drawOverlays()

  love.graphics.setScissor()
  love.graphics.pop()

  -- barre di letterbox esterne
  love.graphics.setColor(0, 0, 0)
  if ox > 0 then
    love.graphics.rectangle("fill", 0, 0, ox, H)
    love.graphics.rectangle("fill", W - ox, 0, ox, H)
  end
  if oy > 0 then
    love.graphics.rectangle("fill", 0, 0, W, oy)
    love.graphics.rectangle("fill", 0, H - oy, W, oy)
  end
end

function love.keypressed(key)
  if key == "escape" then love.event.quit() end
  if key == "r" then initLevel(level) return end
  -- dalla title screen del prologo si entra nel castello
  if key == "return" and level == 1 and cine.on and cine.stage >= 3 then
    initLevel(2)
    return
  end
  if key == "space" or key == "z" or key == "k" then
    player.jbuf = JBUF
  end
  -- fendente di spada (solo nel castello, solo dopo averla raccolta)
  if (key == "x" or key == "f") and level == 2 and player.hasSword
     and (player.state == "ground" or player.state == "air")
     and (player.atkT or 0) <= -0.10 and (player.drawT or 0) <= 0 then
    player.atkT = ATK_DUR
  end
end
