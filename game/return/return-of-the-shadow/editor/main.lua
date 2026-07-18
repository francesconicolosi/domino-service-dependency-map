--========================================================================
--  THE RETURN OF THE SHADOW — Level Editor
--
--  Editor visuale con gli stessi asset procedurali del gioco (rupi in
--  pixel art, erba, fasce scalabili). Salva un file `level.lua` che il
--  gioco carica automaticamente se copiato accanto al suo main.lua.
--
--  Mouse:
--    trascina sul vuoto        crea una piattaforma
--    click su una piattaforma  seleziona · trascina per spostare
--    trascina un bordo         ridimensiona
--    rotellina                 zoom
--    tasto centrale + drag     pan
--    click destro su una bandierina   elimina il checkpoint
--  Tasti:
--    TAB  passa dal Livello 1 (la scalata) al Livello 2 (il castello)
--    W A S D / frecce  pan       B  trave stretta (beam)
--    C  parete scalabile          N  fissa la base della via (climbBot) al mouse
--    K  checkpoint al mouse       X / CANC  elimina la piattaforma
--    G  snap alla griglia         S  salva level.lua     L  ricarica
--    H  aiuto                     ESC  esci
--========================================================================

local VW, VH = 1280, 720
local PIX    = 2
local pixCanvas

local CASTLE_X, PROM_Y = 6500, 424

-- Palette condivisa con il gioco
local COL = {
  skyTop  = {0.22, 0.12, 0.36},
  skyLow  = {0.99, 0.55, 0.24},
  rockLit = {0.98, 0.62, 0.34},
  snow    = {0.90, 0.88, 0.97},
}
local STONE = {
  base  = {0.335, 0.305, 0.375},
  mid   = {0.265, 0.240, 0.310},
  dark  = {0.160, 0.145, 0.205},
  lit   = {0.475, 0.440, 0.485},
  moss  = {0.30, 0.42, 0.18},
  mossL = {0.50, 0.68, 0.25},
}

local function clamp(v, a, b) if v < a then return a elseif v > b then return b end return v end

--------------------------------------------------------------- LIVELLO
-- Livello di default: quello del prologo
local plats1 = {
  {x=-260, y=1420, w=260, h=980},
  {x=0,    y=1800, w=760, h=560},
  {x=840,  y=1728, w=220, h=640},
  {x=1140, y=1652, w=190, h=720},
  {x=1520, y=1636, w=330, h=740},
  {x=1920, y=1476, w=260, h=900},
  {x=2260, y=1468, w=150, h=16, beam=true},
  {x=2480, y=1446, w=140, h=16, beam=true},
  {x=2700, y=1424, w=320, h=950},
  {x=3080, y=1044, w=280, h=1330, climbL=true, climbBot=1508},
  {x=3420, y=1000, w=230, h=1380},
  {x=3760, y=856,  w=210, h=1520},
  {x=4030, y=846,  w=140, h=16, beam=true},
  {x=4230, y=816,  w=280, h=1560},
  {x=4740, y=796,  w=250, h=1580},
  {x=5060, y=516,  w=300, h=1860, climbL=true, climbBot=880},
  {x=5420, y=470,  w=190, h=1900},
  {x=5680, y=PROM_Y, w=1520, h=1960},
}
local checkpoints1 = {
  {x=160,  y=1800}, {x=1620, y=1636}, {x=2760, y=1424},
  {x=3480, y=1000}, {x=4310, y=816},  {x=5760, y=PROM_Y},
}

--============================ LIVELLO 2: IL CASTELLO ============================
local plats2 = {
  {x=-60,  y=900, w=1000, h=560},
  {x=1300, y=744, w=660, h=700},
  {x=2100, y=744, w=430, h=700},
  {x=2530, y=384, w=260, h=1060, climbL=true, climbBot=700},
  {x=2790, y=384, w=560, h=1420},
  {x=3480, y=384, w=760, h=1420},
}
for i = 0, 5 do
  plats2[#plats2+1] = {x = 940 + i * 60, y = 900 - (i + 1) * 26, w = 66, h = 560 + (i + 1) * 26}
end
local checkpoints2 = {
  {x=150, y=900}, {x=1360, y=744}, {x=2160, y=744}, {x=2860, y=384}, {x=3560, y=384},
}

local curLevel = 1
local plats, checkpoints = plats1, checkpoints1

-- riferimenti fissi delle entita' del Livello 2 (definite nel gioco):
-- mostrati come marker cosi' il level design ci si puo' regolare intorno
local L2_MARKS = {
  trap   = {x = 2360, y = 452, w = 66, h = 42},
  button = {x = 2170, y = 744, w = 44},
  skels  = {{2170, 2470, 744}, {2880, 3300, 384}, {3560, 3960, 384}},
  door   = {x = 4100, y = 384},
}

--------------------------------------------------------------- RENDER ROCCIA
-- (identico al gioco: sagome frastagliate, strati, appigli, erba, neve)
local function invalidate(p) p._tris, p._pts, p._leftI = nil, nil, nil end

local function rockOutline(p, pi)
  if p._tris then return p._tris end
  local rng = love.math.newRandomGenerator(pi * 4211 + 13)
  local pts = {}
  local function push(x, y) pts[#pts+1] = x; pts[#pts+1] = y end
  push(p.x, p.y)
  push(p.x + p.w, p.y)
  if not p.climbR then
    local y = p.y
    while y < p.y + p.h - 44 do
      y = y + 30 + rng:random() * 42
      push(p.x + p.w + rng:random() * 14, math.min(y, p.y + p.h - 6))
    end
  end
  push(p.x + p.w, p.y + p.h)
  push(p.x, p.y + p.h)
  if not p.climbL then
    p._leftI = #pts + 1
    local ys = {}
    local y = p.y + p.h
    while y > p.y + 44 do
      y = y - (30 + rng:random() * 42)
      ys[#ys+1] = math.max(y, p.y + 8)
    end
    for _, yy in ipairs(ys) do push(p.x - rng:random() * 14, yy) end
  end
  local ok, tris = pcall(love.math.triangulate, pts)
  p._tris = ok and tris or {
    {p.x, p.y, p.x + p.w, p.y, p.x + p.w, p.y + p.h},
    {p.x, p.y, p.x + p.w, p.y + p.h, p.x, p.y + p.h},
  }
  p._pts = pts
  return p._tris
end

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

local function drawClimbMarks(p, pi)
  local rng = love.math.newRandomGenerator(pi * 557 + 3)
  local x = p.x
  local yEnd = math.min((p.climbBot or (p.y + p.h)) + 30, p.y + p.h - 16)
  love.graphics.setColor(STONE.lit[1], STONE.lit[2], STONE.lit[3], 0.30)
  love.graphics.rectangle("fill", x, p.y + 4, 18, yEnd - p.y - 4)
  love.graphics.setColor(STONE.dark[1], STONE.dark[2], STONE.dark[3], 0.95)
  love.graphics.rectangle("fill", x + 18, p.y + 4, 2, yEnd - p.y - 4)
  local y = p.y + 26
  while y < yEnd - 14 do
    love.graphics.setColor(0, 0, 0, 0.55)
    love.graphics.rectangle("fill", x + 2, y, 13, 4)
    love.graphics.setColor(STONE.lit[1], STONE.lit[2], STONE.lit[3], 0.85)
    love.graphics.rectangle("fill", x + 2, y - 2, 13, 2)
    if rng:random() < 0.35 then
      love.graphics.setColor(STONE.mid[1], STONE.mid[2], STONE.mid[3], 1)
      love.graphics.rectangle("fill", x - 4, y + 9, 5, 6)
      love.graphics.setColor(STONE.lit[1], STONE.lit[2], STONE.lit[3], 0.7)
      love.graphics.rectangle("fill", x - 4, y + 9, 5, 2)
    end
    y = y + 26
  end
end

-- LIVELLO 2: muratura del castello (identica al gioco)
local BRICK = {
  base = {0.30, 0.27, 0.30}, dark = {0.165, 0.145, 0.175},
  lit  = {0.42, 0.38, 0.40}, mort = {0.11, 0.10, 0.125},
}

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

local function drawPlats()
  love.graphics.setLineWidth(1)
  for pi, p in ipairs(plats) do
    local rng = love.math.newRandomGenerator(pi * 733 + 5)
    if p.beam then
      love.graphics.setColor(STONE.mid[1], STONE.mid[2], STONE.mid[3], 1)
      love.graphics.rectangle("fill", p.x, p.y, p.w, p.h)
      love.graphics.setColor(STONE.dark[1], STONE.dark[2], STONE.dark[3], 1)
      love.graphics.rectangle("fill", p.x, p.y + p.h - 3, p.w, 3)
      love.graphics.setColor(COL.rockLit[1], COL.rockLit[2], COL.rockLit[3], 0.7)
      love.graphics.rectangle("fill", p.x + 1, p.y, p.w - 2, 2)
      if curLevel == 1 then drawGrass(p.x, p.y, p.w, rng)
      else drawFlags(p.x, p.y, p.w, rng) end
    elseif curLevel == 2 then
      drawBrickBody(p, pi)
      if p.climbL then drawClimbMarks(p, pi) end
      love.graphics.setColor(1.0, 0.72, 0.4, 0.30)
      love.graphics.rectangle("fill", p.x, p.y, p.w, 2)
      drawFlags(p.x, p.y, p.w, rng)
    else
      local tris = rockOutline(p, pi)
      love.graphics.setColor(STONE.base[1], STONE.base[2], STONE.base[3], 1)
      for _, t in ipairs(tris) do love.graphics.polygon("fill", t) end
      local hLim = math.min(p.h, 820)
      for k = 1, 4 do
        local sy = p.y + hLim * (0.30 + k * 0.17)
        if sy < p.y + p.h then
          love.graphics.setColor(STONE.dark[1], STONE.dark[2], STONE.dark[3], 0.17)
          love.graphics.rectangle("fill", p.x, sy, p.w, p.y + p.h - sy)
        end
      end
      for _ = 1, math.max(3, math.floor(hLim / 110)) do
        local sy = p.y + 22 + rng:random() * (hLim - 34)
        love.graphics.setColor(0, 0, 0, 0.22)
        love.graphics.rectangle("fill", p.x + 3, sy, p.w - 6, 2)
        love.graphics.setColor(STONE.lit[1], STONE.lit[2], STONE.lit[3], 0.12)
        love.graphics.rectangle("fill", p.x + 3, sy - 2, p.w - 6, 2)
      end
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
      if p._pts and p._leftI then
        love.graphics.setColor(COL.rockLit[1], COL.rockLit[2], COL.rockLit[3], 0.30)
        love.graphics.setLineWidth(2)
        local pts = p._pts
        love.graphics.line(pts[#pts-1], pts[#pts], p.x, p.y)
        for i = p._leftI, #pts - 3, 2 do
          love.graphics.line(pts[i], pts[i+1], pts[i+2], pts[i+3])
        end
      end
      if p.climbL then drawClimbMarks(p, pi) end
      love.graphics.setColor(COL.rockLit[1], COL.rockLit[2], COL.rockLit[3], 0.6)
      love.graphics.rectangle("fill", p.x, p.y, p.w, 2)
      drawGrass(p.x, p.y, p.w, rng)
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

--------------------------------------------------------------- EDITOR
local cam  = {x = 400, y = 1500, z = 0.5}
local snap = true
local GRID = 10
local sel  = nil                       -- piattaforma selezionata
local drag = nil                       -- {mode="new"/"move"/"resize-..", ...}
local panDrag = nil
local showHelp = true
local statusMsg, statusT = "", 0
local FONT

local function setStatus(s) statusMsg, statusT = s, 3 end
local function snapv(v) if snap then return math.floor(v / GRID + 0.5) * GRID end return math.floor(v + 0.5) end

local function toWorld(mx, my)
  local W, H = love.graphics.getDimensions()
  local S = math.min(W / VW, H / VH)
  local ox, oy = (W - VW * S) / 2, (H - VH * S) / 2
  local vx, vy = (mx - ox) / S, (my - oy) / S
  return (vx - VW/2) / cam.z + cam.x, (vy - VH/2) / cam.z + cam.y
end

local function platAt(wx, wy)
  for i = #plats, 1, -1 do
    local p = plats[i]
    if wx >= p.x - 6 and wx <= p.x + p.w + 6 and wy >= p.y - 6 and wy <= p.y + p.h + 6 then
      return p, i
    end
  end
end

-- quale bordo della piattaforma è sotto il mouse? (per il resize)
local function edgeAt(p, wx, wy)
  local m = 10 / cam.z
  local L = math.abs(wx - p.x) < m
  local R = math.abs(wx - (p.x + p.w)) < m
  local T = math.abs(wy - p.y) < m
  local B = math.abs(wy - (p.y + p.h)) < m
  if not (L or R or T or B) then return nil end
  return (T and "n" or B and "s" or "") .. (L and "w" or R and "e" or "")
end

--------------------------------------------------------------- SALVATAGGIO
local function levelFile()
  return curLevel == 1 and "level.lua" or "level2.lua"
end

local function serialize()
  local out = {"-- " .. levelFile() .. " — generato dal Level Editor", "return {", "  plats = {"}
  for _, p in ipairs(plats) do
    local s = string.format("    {x=%d, y=%d, w=%d, h=%d", p.x, p.y, p.w, p.h)
    if p.beam   then s = s .. ", beam=true" end
    if p.climbL then s = s .. ", climbL=true" end
    if p.climbR then s = s .. ", climbR=true" end
    if p.climbBot then s = s .. string.format(", climbBot=%d", p.climbBot) end
    out[#out+1] = s .. "},"
  end
  out[#out+1] = "  },"
  out[#out+1] = "  checkpoints = {"
  for _, c in ipairs(checkpoints) do
    out[#out+1] = string.format("    {x=%d, y=%d},", c.x, c.y)
  end
  out[#out+1] = "  },"
  out[#out+1] = "}"
  return table.concat(out, "\n")
end

local function saveLevel()
  love.filesystem.write(levelFile(), serialize())
  setStatus("Saved to " .. love.filesystem.getSaveDirectory() .. "/" .. levelFile()
            .. " — copy it next to the game's main.lua")
end

local function loadLevel()
  local f = levelFile()
  if not love.filesystem.getInfo(f) then setStatus("No saved " .. f .. " found") return end
  local ok, chunk = pcall(love.filesystem.load, f)
  if ok and chunk then
    local ok2, data = pcall(chunk)
    if ok2 and type(data) == "table" and data.plats then
      plats = data.plats
      checkpoints = data.checkpoints or checkpoints
      if curLevel == 1 then plats1, checkpoints1 = plats, checkpoints
      else plats2, checkpoints2 = plats, checkpoints end
      sel = nil
      setStatus(f .. " loaded")
      return
    end
  end
  setStatus("Failed to load " .. f)
end

local function switchLevel()
  curLevel = (curLevel == 1) and 2 or 1
  if curLevel == 1 then
    plats, checkpoints = plats1, checkpoints1
    cam.x, cam.y, cam.z = 400, 1500, 0.5
  else
    plats, checkpoints = plats2, checkpoints2
    cam.x, cam.y, cam.z = 700, 700, 0.5
  end
  sel, drag = nil, nil
  setStatus("Editing Level " .. curLevel .. (curLevel == 2 and " — The Witch's Keep" or " — The Ascent"))
end

--------------------------------------------------------------- LOVE
function love.load()
  love.graphics.setDefaultFilter("nearest", "nearest")
  love.graphics.setLineStyle("rough")
  pixCanvas = love.graphics.newCanvas(VW / PIX, VH / PIX)
  pixCanvas:setFilter("nearest", "nearest")
  FONT = love.graphics.newFont(14)
  love.graphics.setFont(FONT)
end

function love.update(dt)
  statusT = math.max(0, statusT - dt)
  local sp = 900 * dt / cam.z
  local kd = love.keyboard.isDown
  if kd("a") or kd("left")  then cam.x = cam.x - sp end
  if kd("d") or kd("right") then cam.x = cam.x + sp end
  if kd("w") or kd("up")    then cam.y = cam.y - sp end
  if kd("s") or kd("down")  then cam.y = cam.y + sp end
end

function love.wheelmoved(_, dy)
  cam.z = clamp(cam.z * (1 + dy * 0.12), 0.12, 2.5)
end

function love.mousepressed(mx, my, btn)
  local wx, wy = toWorld(mx, my)
  if btn == 3 then panDrag = {mx = mx, my = my, cx = cam.x, cy = cam.y} return end
  if btn == 2 then
    -- click destro: elimina il checkpoint vicino
    for i, c in ipairs(checkpoints) do
      if math.abs(wx - c.x) < 24 / cam.z and math.abs(wy - c.y) < 40 / cam.z then
        table.remove(checkpoints, i)
        setStatus("Checkpoint removed")
        return
      end
    end
    return
  end
  if btn ~= 1 then return end
  local p, pi = platAt(wx, wy)
  if p then
    sel = p
    local e = edgeAt(p, wx, wy)
    if e then
      drag = {mode = "resize", edge = e, p = p}
    else
      drag = {mode = "move", p = p, dx = wx - p.x, dy = wy - p.y}
    end
  else
    sel = nil
    drag = {mode = "new", x0 = snapv(wx), y0 = snapv(wy)}
  end
end

function love.mousemoved(mx, my)
  if panDrag then
    local W, H = love.graphics.getDimensions()
    local S = math.min(W / VW, H / VH)
    cam.x = panDrag.cx - (mx - panDrag.mx) / S / cam.z
    cam.y = panDrag.cy - (my - panDrag.my) / S / cam.z
    return
  end
  if not drag then return end
  local wx, wy = toWorld(mx, my)
  if drag.mode == "move" then
    local p = drag.p
    p.x = snapv(wx - drag.dx)
    p.y = snapv(wy - drag.dy)
    invalidate(p)
  elseif drag.mode == "resize" then
    local p = drag.p
    local e = drag.edge
    if e:find("e") then p.w = math.max(20, snapv(wx) - p.x) end
    if e:find("s") then p.h = math.max(12, snapv(wy) - p.y) end
    if e:find("w") then
      local nx = math.min(snapv(wx), p.x + p.w - 20)
      p.w = p.w + (p.x - nx); p.x = nx
    end
    if e:find("n") then
      local ny = math.min(snapv(wy), p.y + p.h - 12)
      p.h = p.h + (p.y - ny); p.y = ny
    end
    invalidate(p)
  end
end

function love.mousereleased(mx, my, btn)
  if btn == 3 then panDrag = nil return end
  if not drag then return end
  if drag.mode == "new" then
    local wx, wy = toWorld(mx, my)
    local x0, y0 = drag.x0, drag.y0
    local x1, y1 = snapv(wx), snapv(wy)
    local nx, ny = math.min(x0, x1), math.min(y0, y1)
    local nw, nh = math.abs(x1 - x0), math.abs(y1 - y0)
    if nw >= 30 and nh >= 12 then
      local p = {x = nx, y = ny, w = nw, h = nh}
      if nh <= 24 then p.beam = true end            -- sottile = trave
      plats[#plats+1] = p
      sel = p
      setStatus("Platform created" .. (p.beam and " (beam)" or ""))
    end
  end
  drag = nil
end

function love.keypressed(key)
  if key == "escape" then love.event.quit() end
  if key == "h" then showHelp = not showHelp end
  if key == "tab" then switchLevel() return end
  if key == "g" then snap = not snap; setStatus("Snap: " .. (snap and "ON" or "OFF")) end
  local ctrl = love.keyboard.isDown("lctrl") or love.keyboard.isDown("rctrl")
  if key == "f5" or (key == "s" and ctrl) then saveLevel() return end
  if key == "l" and ctrl then loadLevel() return end
  if key == "k" then
    local wx, wy = toWorld(love.mouse.getPosition())
    checkpoints[#checkpoints+1] = {x = snapv(wx), y = snapv(wy)}
    setStatus("Checkpoint added")
  end
  if sel then
    if key == "b" then sel.beam = not sel.beam; invalidate(sel); setStatus("Beam: " .. tostring(sel.beam)) end
    if key == "c" then sel.climbL = not sel.climbL; invalidate(sel); setStatus("Climbable wall: " .. tostring(sel.climbL)) end
    if key == "n" then
      local _, wy = toWorld(love.mouse.getPosition())
      if sel.climbBot then sel.climbBot = nil; setStatus("climbBot cleared")
      else sel.climbBot = snapv(wy); setStatus("climbBot = " .. sel.climbBot) end
    end
    if key == "x" or key == "delete" then
      for i, p in ipairs(plats) do
        if p == sel then table.remove(plats, i) break end
      end
      sel = nil
      setStatus("Platform deleted")
    end
  end
end

--------------------------------------------------------------- DRAW
local function drawWorld()
  if curLevel == 1 then
    -- cielo del crepuscolo (gradiente semplice)
    for i = 0, 20 do
      local k = i / 20
      love.graphics.setColor(
        COL.skyTop[1] + (COL.skyLow[1] - COL.skyTop[1]) * k,
        COL.skyTop[2] + (COL.skyLow[2] - COL.skyTop[2]) * k,
        COL.skyTop[3] + (COL.skyLow[3] - COL.skyTop[3]) * k, 1)
      love.graphics.rectangle("fill", 0, VH * k, VW, VH / 20 + 1)
    end
  else
    -- interno del castello: buio
    for i = 0, 16 do
      local k = i / 16
      love.graphics.setColor(0.055 + 0.05 * k, 0.05 + 0.04 * k, 0.085 + 0.055 * k, 1)
      love.graphics.rectangle("fill", 0, VH * k, VW, VH / 16 + 1)
    end
  end

  love.graphics.push()
  love.graphics.translate(VW / 2, VH / 2)
  love.graphics.scale(cam.z)
  love.graphics.translate(-cam.x, -cam.y)

  -- griglia leggera
  if cam.z > 0.25 then
    love.graphics.setColor(1, 1, 1, 0.05)
    local step = 100
    local x0 = math.floor((cam.x - VW/cam.z) / step) * step
    local x1 = cam.x + VW / cam.z
    local y0 = math.floor((cam.y - VH/cam.z) / step) * step
    local y1 = cam.y + VH / cam.z
    for x = x0, x1, step do love.graphics.line(x, y0, x, y1) end
    for y = y0, y1, step do love.graphics.line(x0, y, x1, y) end
  end

  if curLevel == 1 then
    -- sagoma del castello (riferimento di fine livello)
    love.graphics.setColor(0.155, 0.145, 0.24, 0.85)
    love.graphics.rectangle("fill", CASTLE_X - 120, PROM_Y - 260, 240, 260)
    love.graphics.rectangle("fill", CASTLE_X - 170, PROM_Y - 180, 60, 180)
    love.graphics.rectangle("fill", CASTLE_X + 110, PROM_Y - 180, 60, 180)
    love.graphics.setColor(0.07, 0.065, 0.115, 1)
    love.graphics.rectangle("fill", CASTLE_X - 34, PROM_Y - 88, 68, 88)
  end

  drawPlats()

  -- marker delle entita' fisse del Livello 2 (trappola, pulsante, scheletri, porta)
  if curLevel == 2 then
    local M = L2_MARKS
    love.graphics.setColor(0.9, 0.55, 0.2, 0.85)
    love.graphics.rectangle("line", M.trap.x - M.trap.w/2, M.trap.y, M.trap.w, M.trap.h)
    love.graphics.line(M.trap.x, 40, M.trap.x, M.trap.y)
    love.graphics.print("TRAP", M.trap.x - 18, M.trap.y - 22)
    love.graphics.setColor(0.85, 0.75, 0.35, 0.9)
    love.graphics.rectangle("fill", M.button.x - M.button.w/2, M.button.y - 5, M.button.w, 5)
    love.graphics.print("SWITCH", M.button.x - 26, M.button.y - 30)
    love.graphics.setColor(0.85, 0.85, 0.8, 0.8)
    for _, s in ipairs(M.skels) do
      love.graphics.line(s[1], s[3] - 8, s[2], s[3] - 8)
      love.graphics.circle("fill", (s[1] + s[2]) / 2, s[3] - 20, 6)
      love.graphics.print("SKELETON", (s[1] + s[2]) / 2 - 34, s[3] - 52)
    end
    love.graphics.setColor(0.5, 0.75, 0.7, 0.9)
    love.graphics.rectangle("line", M.door.x, M.door.y - 150, 90, 150)
    love.graphics.print("EXIT", M.door.x + 24, M.door.y - 174)
  end

  -- checkpoint: bandierine
  for _, c in ipairs(checkpoints) do
    love.graphics.setColor(0.30, 0.23, 0.14, 1)
    love.graphics.rectangle("fill", c.x - 1.5, c.y - 46, 3, 46)
    love.graphics.setColor(0.74, 0.31, 0.18, 1)
    love.graphics.polygon("fill", c.x + 1.5, c.y - 46, c.x + 26, c.y - 39, c.x + 1.5, c.y - 32)
  end

  -- selezione
  if sel then
    love.graphics.setColor(0.60, 0.82, 0.78, 0.9)
    love.graphics.setLineWidth(2 / cam.z)
    love.graphics.rectangle("line", sel.x, sel.y, sel.w, sel.h)
    if sel.climbBot then
      love.graphics.setColor(0.98, 0.62, 0.34, 0.9)
      love.graphics.line(sel.x - 26, sel.climbBot, sel.x + 26, sel.climbBot)
    end
  end

  love.graphics.pop()
end

function love.draw()
  local W, H = love.graphics.getDimensions()
  local S = math.min(W / VW, H / VH)
  local ox, oy = (W - VW * S) / 2, (H - VH * S) / 2

  love.graphics.setCanvas(pixCanvas)
  love.graphics.clear(0, 0, 0, 1)
  love.graphics.push()
  love.graphics.scale(1 / PIX)
  drawWorld()
  love.graphics.pop()
  love.graphics.setCanvas()

  love.graphics.push()
  love.graphics.translate(ox, oy)
  love.graphics.scale(S)
  love.graphics.setColor(1, 1, 1, 1)
  love.graphics.draw(pixCanvas, 0, 0, 0, PIX, PIX)

  -- HUD
  love.graphics.setColor(0, 0, 0, 0.55)
  love.graphics.rectangle("fill", 0, 0, VW, 26)
  love.graphics.setColor(0.94, 0.89, 0.78, 1)
  local info = string.format("LEVEL %d (%s)  ·  TAB switch  ·  cam %d,%d  zoom %.2f  snap %s  plats %d  checkpoints %d",
    curLevel, curLevel == 1 and "The Ascent" or "The Witch's Keep",
    cam.x, cam.y, cam.z, snap and "ON" or "OFF", #plats, #checkpoints)
  love.graphics.print(info, 10, 5)
  if sel then
    local flags = (sel.beam and " beam" or "") .. (sel.climbL and " climbL" or "")
      .. (sel.climbBot and (" climbBot=" .. sel.climbBot) or "")
    love.graphics.print(string.format("selected: x=%d y=%d w=%d h=%d%s", sel.x, sel.y, sel.w, sel.h, flags),
      10, VH - 26)
  end

  if statusT > 0 then
    love.graphics.setColor(0, 0, 0, 0.65)
    love.graphics.rectangle("fill", 0, 30, VW, 24)
    love.graphics.setColor(0.60, 0.82, 0.78, 1)
    love.graphics.print(statusMsg, 10, 34)
  end

  if showHelp then
    local lines = {
      "LEVEL EDITOR — H to hide this help",
      "",
      "TAB ....................... switch Level 1 / Level 2 (castle)",
      "Drag on empty space ....... create platform (thin = beam)",
      "Click platform ............ select · drag to move · drag edge to resize",
      "B ......................... toggle beam (narrow ledge)",
      "C ......................... toggle climbable wall (left face)",
      "N ......................... set/clear climb route bottom at mouse height",
      "K ......................... add checkpoint at mouse",
      "Right-click flag .......... remove checkpoint",
      "X / DEL ................... delete selected platform",
      "G ......................... toggle grid snap",
      "CTRL+S / F5 ............... save level.lua        CTRL+L  load",
      "WASD / arrows ............. pan    wheel  zoom    middle-drag  pan",
      "",
      "Saves level.lua (L1) or level2.lua (L2): copy them",
      "next to the game's main.lua to play your layout.",
    }
    love.graphics.setColor(0, 0, 0, 0.72)
    love.graphics.rectangle("fill", VW - 470, 40, 460, 26 + #lines * 19)
    love.graphics.setColor(0.94, 0.89, 0.78, 1)
    for i, l in ipairs(lines) do
      love.graphics.print(l, VW - 456, 52 + (i - 1) * 19)
    end
  end

  love.graphics.pop()
end
