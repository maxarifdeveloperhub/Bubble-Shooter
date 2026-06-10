import React, { useRef, useEffect, useState } from 'react';
import { Level, GameSettings, PowerUpType } from '../types';
import { SoundManager } from '../utils/audio';
import { Volume2, VolumeX, RotateCcw, Pause, Sparkles, Flame, Eye } from 'lucide-react';

interface CanvasGameProps {
  level: Level;
  settings: GameSettings;
  unlockedPowerups: { bomb: number; rainbow: number; guideLine: number };
  onWin: (score: number, stars: number) => void;
  onLose: (reason: 'shots' | 'ceiling') => void;
  onPause: () => void;
  onScoreUpdate: (score: number, remainingShots: number, combo: number) => void;
  onUpdateCoins: (coins: number) => void;
  onUsePowerup: (type: PowerUpType) => void;
  activePowerup: PowerUpType | null;
  setActivePowerup: (type: PowerUpType | null) => void;
}

// Canvas sizing
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 500;
const BUBBLE_RADIUS = 20;
const GRID_COLS = 8;
const GRID_ROWS = 12;

// Real layout spacing math
const LEFT_MARGIN = (CANVAS_WIDTH - (GRID_COLS * BUBBLE_RADIUS * 2 + BUBBLE_RADIUS)) / 2;
const VERT_SPACING = BUBBLE_RADIUS * Math.sqrt(3);

const COLOR_MAP: { [key: string]: string } = {
  red: '#f43f5e',
  blue: '#3b82f6',
  green: '#10b981',
  yellow: '#fbbf24',
  purple: '#8b5cf6',
  orange: '#f97316',
};

interface ShotBubble {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  isPowerup: PowerUpType | null;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

interface FallingBubble {
  x: number;
  y: number;
  vy: number;
  color: string;
  radius: number;
  isPowerup: PowerUpType | null;
}

interface FloatingScore {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  life: number;
}

export const CanvasGame: React.FC<CanvasGameProps> = ({
  level,
  settings,
  unlockedPowerups,
  onWin,
  onLose,
  onPause,
  onScoreUpdate,
  onUpdateCoins,
  onUsePowerup,
  activePowerup,
  setActivePowerup,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Game Play states
  const [board, setBoard] = useState<(string | null)[][]>([]);
  const [shotsLeft, setShotsLeft] = useState(level.maxShots);
  const [currentScore, setCurrentScore] = useState(0);
  const [currentCombo, setCurrentCombo] = useState(0);

  // Shooter bubbles state managed as local refs/variables for the fluid animation loop
  const shooterColorRef = useRef<string>('red');
  const nextShooterColorRef = useRef<string>('blue');
  const activePowerupRef = useRef<PowerUpType | null>(null);

  // Sync state refs to avoid state capture in RAF loop
  const boardRef = useRef<(string | null)[][]>([]);
  const shotsLeftRef = useRef<number>(level.maxShots);
  const pointerXRef = useRef<number>(200);
  const pointerYRef = useRef<number>(250);
  const isPointerDownRef = useRef<boolean>(false);

  // Active flying bubble
  const activeShotRef = useRef<ShotBubble | null>(null);

  // FX lists (Particles, score fall, falling grid bubbles)
  const particlesRef = useRef<Particle[]>([]);
  const fallingGridBubblesRef = useRef<FallingBubble[]>([]);
  const floatingScoresRef = useRef<FloatingScore[]>([]);

  // Cannon base config
  const CANNON_X = CANVAS_WIDTH / 2;
  const CANNON_Y = CANVAS_HEIGHT - 35;

  // Initialize level grid
  useEffect(() => {
    const clonedGrid = JSON.parse(JSON.stringify(level.grid));
    // pad rows up to GRID_ROWS
    while (clonedGrid.length < GRID_ROWS) {
      clonedGrid.push(Array(GRID_COLS).fill(null));
    }
    setBoard(clonedGrid);
    boardRef.current = clonedGrid;
    setShotsLeft(level.maxShots);
    shotsLeftRef.current = level.maxShots;
    setCurrentScore(0);
    setCurrentCombo(0);

    // Initial random colors based on level grid
    const remainingColors = getRemainingGridColors(clonedGrid);
    shooterColorRef.current = getRandomColor(remainingColors);
    nextShooterColorRef.current = getRandomColor(remainingColors);

    // Reset physics lists
    particlesRef.current = [];
    fallingGridBubblesRef.current = [];
    floatingScoresRef.current = [];
    activeShotRef.current = null;
  }, [level]);

  // Sync powerup ref
  useEffect(() => {
    activePowerupRef.current = activePowerup;
  }, [activePowerup]);

  // Utility to find what colors are still present inside the grid
  function getRemainingGridColors(grid: (string | null)[][]): string[] {
    const list = new Set<string>();
    grid.forEach((row) => {
      row.forEach((cell) => {
        if (cell && COLOR_MAP[cell]) {
          list.add(cell);
        }
      });
    });
    return list.size > 0 ? Array.from(list) : ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
  }

  function getRandomColor(colors: string[]): string {
    return colors[Math.floor(Math.random() * colors.length)];
  }

  const swapBubbles = () => {
    if (activeShotRef.current) return; // cannot swap mid-flight
    SoundManager.playClick(settings.sfxOn);
    const temp = shooterColorRef.current;
    shooterColorRef.current = nextShooterColorRef.current;
    nextShooterColorRef.current = temp;
  };

  // Convert row, col indexes to canvas pixel coordinate centers (staggered Hex grid)
  const getBubbleCoordinates = (row: number, col: number) => {
    const offset = (row % 2 === 1) ? BUBBLE_RADIUS : 0;
    const x = LEFT_MARGIN + col * BUBBLE_RADIUS * 2 + offset + BUBBLE_RADIUS;
    const y = BUBBLE_RADIUS + row * VERT_SPACING + 15; // padding top
    return { x, y };
  };

  // Traces path of aiming simulation (with bounced side-walls reflection coords)
  const getGuidePath = () => {
    const pathPoints: { x: number; y: number }[] = [{ x: CANNON_X, y: CANNON_Y }];
    
    // Angle math from cannon upwards
    const angleX = pointerXRef.current - CANNON_X;
    const angleY = pointerYRef.current - CANNON_Y;
    let angle = Math.atan2(angleY, angleX);

    // Constrain shooting angled limits upwards (prevent shooting sideways/down)
    const MIN_ANGLE = -Math.PI + 0.15;
    const MAX_ANGLE = -0.15;
    if (angle > MAX_ANGLE && angle < Math.PI / 2) {
      angle = MAX_ANGLE;
    } else if (angle < MIN_ANGLE || angle >= Math.PI / 2) {
      angle = MIN_ANGLE;
    }

    let curX = CANNON_X;
    let curY = CANNON_Y;
    let dx = Math.cos(angle);
    let dy = Math.sin(angle);

    // Trace guide line up to ceiling or collision boundary
    const traceRadius = BUBBLE_RADIUS;
    let maxBounces = activePowerupRef.current === 'guideLine' ? 5 : 2;

    for (let i = 0; i < 200; i++) {
      curX += dx * 4;
      curY += dy * 4;

      // Wrap-bouncers left
      if (curX <= LEFT_MARGIN + traceRadius) {
        if (maxBounces <= 0) break;
        curX = LEFT_MARGIN + traceRadius;
        dx = -dx;
        maxBounces--;
        pathPoints.push({ x: curX, y: curY });
      }
      // Wrap-bouncers right
      if (curX >= CANVAS_WIDTH - LEFT_MARGIN - traceRadius) {
        if (maxBounces <= 0) break;
        curX = CANVAS_WIDTH - LEFT_MARGIN - traceRadius;
        dx = -dx;
        maxBounces--;
        pathPoints.push({ x: curX, y: curY });
      }

      // Ceiling limit
      if (curY <= traceRadius) {
        pathPoints.push({ x: curX, y: curY });
        break;
      }

      // Collision check with bubbles on the board
      let collided = false;
      const currentBoard = boardRef.current;
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          if (currentBoard[r] && currentBoard[r][c] !== null) {
            const bubblePos = getBubbleCoordinates(r, c);
            const dist = Math.hypot(curX - bubblePos.x, curY - bubblePos.y);
            if (dist < BUBBLE_RADIUS * 1.8) {
              collided = true;
              break;
            }
          }
        }
        if (collided) break;
      }

      if (collided) {
        pathPoints.push({ x: curX, y: curY });
        break;
      }
    }

    // Include end point if not pushed
    if (pathPoints[pathPoints.length - 1].x !== curX) {
      pathPoints.push({ x: curX, y: curY });
    }

    return { pathPoints, angle };
  };

  // Shooting Action!
  const fireActiveBubble = () => {
    if (activeShotRef.current) return; // already flying
    if (shotsLeftRef.current <= 0) return;

    const { angle } = getGuidePath();
    const speed = 11; // px per frame
    
    let isPower = activePowerupRef.current;
    let colorToShoot = shooterColorRef.current;
    if (isPower === 'bomb') colorToShoot = 'charcoal';
    if (isPower === 'rainbow') colorToShoot = 'rainbow';

    activeShotRef.current = {
      x: CANNON_X,
      y: CANNON_Y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: colorToShoot,
      isPowerup: isPower
    };

    SoundManager.playShoot(settings.sfxOn);
    
    // Consume powerup indicator if active
    if (isPower) {
      onUsePowerup(isPower);
      setActivePowerup(null);
    }

    // Reduce shots
    setShotsLeft((prev) => {
      const next = prev - 1;
      shotsLeftRef.current = next;
      // Notify parent score module
      onScoreUpdate(currentScore, next, currentCombo);
      return next;
    });

    // Generate successor shot color
    const remainingColors = getRemainingGridColors(boardRef.current);
    shooterColorRef.current = nextShooterColorRef.current;
    nextShooterColorRef.current = getRandomColor(remainingColors);
  };

  // Handles Pointer position moves for aiming
  const updateAimPointer = (clientX: number, clientY: number, rect: DOMRect) => {
    pointerXRef.current = clientX - rect.left;
    pointerYRef.current = clientY - rect.top;
  };

  // Check if any row >= ROW_8 has active bubbles (bottom death line)
  const checkCeilingDeathLimit = (currentBoard: (string | null)[][]) => {
    // 8th row index (from 0 to 11) crosses normal play height limit.
    for (let r = 8; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (currentBoard[r] && currentBoard[r][c] !== null) {
          return true;
        }
      }
    }
    return false;
  };

  // Hex Neighbors check
  const getHexNeighbors = (r: number, c: number) => {
    const list: { r: number; c: number }[] = [];
    // same row
    list.push({ r, c: c - 1 });
    list.push({ r, c: c + 1 });

    // Stagger layout dependent shifts
    if (r % 2 === 0) {
      // row above
      list.push({ r: r - 1, c: c - 1 });
      list.push({ r: r - 1, c: c });
      // row below
      list.push({ r: r + 1, c: c - 1 });
      list.push({ r: r + 1, c: c });
    } else {
      // row above
      list.push({ r: r - 1, c: c });
      list.push({ r: r - 1, c: c + 1 });
      // row below
      list.push({ r: r + 1, c: c });
      list.push({ r: r + 1, c: c + 1 });
    }

    // Filter bounds
    return list.filter((n) => n.r >= 0 && n.r < GRID_ROWS && n.c >= 0 && n.c < GRID_COLS);
  };

  // Find matches of same color using BFS
  const findMatches = (startR: number, startC: number, color: string, currentBoard: (string | null)[][]) => {
    if (!color) return [];
    
    const matches: { r: number; c: number }[] = [];
    const queue: { r: number; c: number }[] = [{ r: startR, c: startC }];
    const visited = new Set<string>();
    visited.add(`${startR},${startC}`);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      matches.push(curr);

      const neighbors = getHexNeighbors(curr.r, curr.c);
      neighbors.forEach((n) => {
        const key = `${n.r},${n.c}`;
        if (!visited.has(key)) {
          const neighborCell = currentBoard[n.r]?.[n.c];
          if (neighborCell && neighborCell === color) {
            visited.add(key);
            queue.push(n);
          }
        }
      });
    }

    return matches;
  };

  // Cascade effect finding un-anchored bubbles linked to Row 0 ceiling
  const dropFloatingBubbles = (currentBoard: (string | null)[][]) => {
    const visited = new Set<string>();
    const queue: { r: number; c: number }[] = [];

    // Queue up row 0 ceiling anchors
    for (let c = 0; c < GRID_COLS; c++) {
      if (currentBoard[0][c] !== null) {
        queue.push({ r: 0, c });
        visited.add(`0,${c}`);
      }
    }

    // Run connection trace BFS
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const neighbors = getHexNeighbors(curr.r, curr.c);
      
      neighbors.forEach((n) => {
        const key = `${n.r},${n.c}`;
        if (!visited.has(key) && currentBoard[n.r]?.[n.c] !== null) {
          visited.add(key);
          queue.push(n);
        }
      });
    }

    // Every grid space that is occupied but wasn't visited is isolated! Drop them.
    const dropped: { r: number; c: number; color: string }[] = [];
    const nextBoard = currentBoard.map((row) => [...row]);

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (nextBoard[r][c] !== null && !visited.has(`${r},${c}`)) {
          dropped.push({ r, c, color: nextBoard[r][c]! });
          nextBoard[r][c] = null;
        }
      }
    }

    return { nextBoard, dropped };
  };

  // Explosion Particle Spawning
  const spawnExplosion = (x: number, y: number, color: string) => {
    const hexColor = COLOR_MAP[color] || '#ffffff';
    const amount = 10;
    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = 1.5 + Math.random() * 3.5;
      particlesRef.current.push({
        id: Math.random(),
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        color: hexColor,
        size: 3 + Math.random() * 4,
        alpha: 1,
        life: 0,
        maxLife: 20 + Math.floor(Math.random() * 20),
      });
    }
  };

  // Handle snap locking shot bubble to correct grid coordinate
  const snapToGrid = (shotX: number, shotY: number, shotColor: string, isPowerup: PowerUpType | null) => {
    let bestR = 0;
    let bestC = 0;
    let minDist = Infinity;

    // Find nearest row, col coordinates
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        // odd rows staggered limits
        if (boardRef.current[r][c] === null) {
          const pos = getBubbleCoordinates(r, c);
          const d = Math.hypot(shotX - pos.x, shotY - pos.y);
          if (d < minDist) {
            minDist = d;
            bestR = r;
            bestC = c;
          }
        }
      }
    }

    // Snap to board!
    const nextBoard = boardRef.current.map((row) => [...row]);

    if (isPowerup === 'bomb') {
      // Bomb pops surrounding bubbles within 2 index distances
      const popPositions: { r: number; c: number; color: string }[] = [];
      const bombSound = settings.sfxOn;
      SoundManager.playPop(bombSound);

      // Simple radial pop
      const posCenterCoords = getBubbleCoordinates(bestR, bestC);
      spawnExplosion(posCenterCoords.x, posCenterCoords.y, 'yellow');
      spawnExplosion(posCenterCoords.x, posCenterCoords.y, 'orange');

      for (let r = Math.max(0, bestR - 1); r <= Math.min(GRID_ROWS - 1, bestR + 1); r++) {
        for (let c = Math.max(0, bestC - 1); c <= Math.min(GRID_COLS - 1, bestC + 1); c++) {
          if (nextBoard[r]?.[c] !== null) {
            popPositions.push({ r, c, color: nextBoard[r][c]! });
            nextBoard[r][c] = null;
          }
        }
      }

      // Drop falling floating leftovers
      const { nextBoard: finalBoard, dropped } = dropFloatingBubbles(nextBoard);
      
      const totalPops = popPositions.length + dropped.length;
      const awardScore = totalPops * 30 + 100;
      const coinReward = Math.ceil(totalPops / 2);

      floatingScoresRef.current.push({
        id: Math.random(),
        x: posCenterCoords.x,
        y: posCenterCoords.y - 15,
        text: `+${awardScore} BOMB!`,
        color: '#ff4500',
        alpha: 1,
        life: 0,
      });

      // Spawn fallen bubbles
      dropped.forEach((item) => {
        const itemPos = getBubbleCoordinates(item.r, item.c);
        fallingGridBubblesRef.current.push({
          x: itemPos.x,
          y: itemPos.y,
          vy: 1,
          color: item.color,
          radius: BUBBLE_RADIUS,
          isPowerup: null,
        });
      });

      // Update States
      popPositions.forEach((p) => {
        const pt = getBubbleCoordinates(p.r, p.c);
        spawnExplosion(pt.x, pt.y, p.color);
      });

      setBoard(finalBoard);
      boardRef.current = finalBoard;
      setCurrentScore((prev) => {
        const next = prev + awardScore;
        onScoreUpdate(next, shotsLeftRef.current, currentCombo);
        return next;
      });
      onUpdateCoins(coinReward);

      // Check win/lose conditions
      checkGameEndStates(finalBoard);
      return;
    }

    if (isPowerup === 'rainbow') {
      // Rainbow bubble inherits color of nearest adjacent anchor or standard random
      // Get neighbors of snapped slot
      const neighbors = getHexNeighbors(bestR, bestC);
      const neighborColors = neighbors
        .map((n) => boardRef.current[n.r]?.[n.c])
        .filter((col): col is string => col !== null && col !== undefined);
      
      const matchedColor = neighborColors.length > 0 ? neighborColors[0] : 'blue';
      shotColor = matchedColor;
    }

    // Normal Snap color
    nextBoard[bestR][bestC] = shotColor;
    setBoard(nextBoard);
    boardRef.current = nextBoard;

    // Run Match Finding BFS
    const matches = findMatches(bestR, bestC, shotColor, nextBoard);

    if (matches.length >= 3) {
      // POP them!
      const finalBoard = nextBoard.map((row) => [...row]);
      matches.forEach((m) => {
        finalBoard[m.r][m.c] = null;
      });

      // Play Sound with combo pitch tuning
      const nextCombo = currentCombo + 1;
      setCurrentCombo(nextCombo);
      SoundManager.playPop(settings.sfxOn, nextCombo);
      if (nextCombo > 1) {
        SoundManager.playComboUp(settings.sfxOn, nextCombo);
        // vibrate if enabled
        if (settings.vibrationOn && navigator.vibrate) {
          navigator.vibrate(10 + nextCombo * 5);
        }
      }

      // Calc matches scores and floating score spawns
      const basePoints = matches.length * 20;
      const comboMultiplier = nextCombo;
      const matchedPoints = basePoints * comboMultiplier;

      // Coins reward
      const coinsEarned = Math.floor(matches.length / 2) + (nextCombo > 2 ? nextCombo : 0);
      onUpdateCoins(coinsEarned);

      // Floating Score
      const snappedCenter = getBubbleCoordinates(bestR, bestC);
      floatingScoresRef.current.push({
        id: Math.random(),
        x: snappedCenter.x,
        y: snappedCenter.y - 10,
        text: `+${matchedPoints} ${nextCombo > 1 ? `Combo x${nextCombo}!` : ''}`,
        color: COLOR_MAP[shotColor],
        alpha: 1,
        life: 0,
      });

      // Spawn popping particles
      matches.forEach((m) => {
        const itemCoords = getBubbleCoordinates(m.r, m.c);
        spawnExplosion(itemCoords.x, itemCoords.y, shotColor);
      });

      // Drop floating isolated bubbles Cascade
      const { nextBoard: finalCeiledBoard, dropped } = dropFloatingBubbles(finalBoard);

      // Process dropped floating bubbles scores
      if (dropped.length > 0) {
        const bonusScore = dropped.length * 40;
        floatingScoresRef.current.push({
          id: Math.random(),
          x: CANVAS_WIDTH / 2,
          y: 200,
          text: `Waterfall Bonus +${bonusScore}!`,
          color: '#fbbf24',
          alpha: 1,
          life: 0,
        });

        onUpdateCoins(dropped.length);

        dropped.forEach((drop) => {
          const itemPos = getBubbleCoordinates(drop.r, drop.c);
          fallingGridBubblesRef.current.push({
            x: itemPos.x,
            y: itemPos.y,
            vy: 2 + Math.random() * 2,
            color: drop.color,
            radius: BUBBLE_RADIUS,
            isPowerup: null,
          });
        });
      }

      const totalWinPoints = matchedPoints + (dropped.length * 40);

      setBoard(finalCeiledBoard);
      boardRef.current = finalCeiledBoard;
      setCurrentScore((prev) => {
        const next = prev + totalWinPoints;
        onScoreUpdate(next, shotsLeftRef.current, nextCombo);
        return next;
      });

      checkGameEndStates(finalCeiledBoard);

    } else {
      // No match group, break combo meter!
      setCurrentCombo(0);
      // Check ceiling doom line failure
      const crossedDangerLine = checkCeilingDeathLimit(nextBoard);

      if (crossedDangerLine) {
        onLose('ceiling');
        return;
      }

      // Check shots exhausted
      if (shotsLeftRef.current <= 0) {
        onLose('shots');
        return;
      }
    }
  };

  // Assess level win or lose logic thresholds
  const checkGameEndStates = (currentBoard: (string | null)[][]) => {
    // Standard Bubble Shooter win: clear all bubbles from grid, or hit top target score
    let totalBubblesLeft = 0;
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (currentBoard[r] && currentBoard[r][c] !== null) {
          totalBubblesLeft++;
        }
      }
    }

    if (totalBubblesLeft === 0) {
      // calculate star rating index
      let earnedStars = 1;
      if (shotsLeftRef.current > level.maxShots * 0.4) earnedStars = 3;
      else if (shotsLeftRef.current > level.maxShots * 0.15) earnedStars = 2;

      onWin(currentScore, earnedStars);
      return;
    }

    // Loose check
    if (shotsLeftRef.current <= 0 && activeShotRef.current === null) {
      onLose('shots');
    }
  };

  // Primary animation game loop (Canvas Draw)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrameId: number;

    const render = () => {
      // Clear viewport space
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw Glassmorphic Backdrop overlay styling
      ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw Danger Warning threshold line (row 8 boundary)
      const dangerLinePos = BUBBLE_RADIUS + 8 * VERT_SPACING + 15 + BUBBLE_RADIUS;
      ctx.beginPath();
      ctx.moveTo(10, dangerLinePos);
      ctx.lineTo(CANVAS_WIDTH - 10, dangerLinePos);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw active Level Grid Bubbles
      const currentBoard = boardRef.current;
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const cellColor = currentBoard[r]?.[c];
          if (cellColor) {
            const pos = getBubbleCoordinates(r, c);
            drawBubble(ctx, pos.x, pos.y, cellColor, BUBBLE_RADIUS);
          }
        }
      }

      // Draw Aiming Guide Points
      if (!activeShotRef.current && shotsLeftRef.current > 0) {
        const { pathPoints } = getGuidePath();
        ctx.beginPath();
        ctx.setLineDash([4, 6]);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = activePowerupRef.current ? '#fbbf24' : 'rgba(255, 255, 255, 0.6)';

        pathPoints.forEach((point, idx) => {
          if (idx === 0) {
            ctx.moveTo(point.x, point.y);
          } else {
            ctx.lineTo(point.x, point.y);
          }
        });
        ctx.stroke();
        ctx.setLineDash([]);

        // Show circular target indicator
        if (pathPoints.length > 1) {
          const lastPt = pathPoints[pathPoints.length - 1];
          ctx.beginPath();
          ctx.arc(lastPt.x, lastPt.y, BUBBLE_RADIUS - 1, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.fill();
        }
      }

      // Physics logic for shot active bubble flight
      if (activeShotRef.current) {
        const shot = activeShotRef.current;
        shot.x += shot.vx;
        shot.y += shot.vy;

        // Side wall bounce
        if (shot.x <= LEFT_MARGIN + BUBBLE_RADIUS) {
          shot.x = LEFT_MARGIN + BUBBLE_RADIUS;
          shot.vx = -shot.vx;
          SoundManager.playBounce(settings.sfxOn);
        } else if (shot.x >= CANVAS_WIDTH - LEFT_MARGIN - BUBBLE_RADIUS) {
          shot.x = CANVAS_WIDTH - LEFT_MARGIN - BUBBLE_RADIUS;
          shot.vx = -shot.vx;
          SoundManager.playBounce(settings.sfxOn);
        }

        // Draw flying shot bubble
        drawBubble(ctx, shot.x, shot.y, shot.color, BUBBLE_RADIUS, shot.isPowerup);

        // Ceiling collision
        if (shot.y <= BUBBLE_RADIUS + 15) {
          snapToGrid(shot.x, shot.y, shot.color, shot.isPowerup);
          activeShotRef.current = null;
        } else {
          // Bubble collision scan
          let collided = false;
          for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < GRID_COLS; c++) {
              if (currentBoard[r]?.[c] !== null) {
                const bubblePos = getBubbleCoordinates(r, c);
                const dist = Math.hypot(shot.x - bubblePos.x, shot.y - bubblePos.y);
                if (dist < BUBBLE_RADIUS * 1.85) {
                  collided = true;
                  break;
                }
              }
            }
            if (collided) break;
          }

          if (collided) {
            snapToGrid(shot.x, shot.y, shot.color, shot.isPowerup);
            activeShotRef.current = null;
          }
        }
      }

      // Draw Cannon and previews
      drawCannon(ctx, CANNON_X, CANNON_Y);

      // Draw Floating score multipliers
      const scores = floatingScoresRef.current;
      for (let i = scores.length - 1; i >= 0; i--) {
        const s = scores[i];
        s.y -= 0.65;
        s.life += 1;
        s.alpha = Math.max(0, 1 - s.life / 35);
        
        ctx.fillStyle = s.color;
        ctx.font = 'bold 12px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.globalAlpha = s.alpha;
        ctx.fillText(s.text, s.x, s.y);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        if (s.life >= 35) {
          scores.splice(i, 1);
        }
      }

      // Draw exploding particle dynamics
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // gravity gravity
        p.life++;
        p.alpha = Math.max(0, 1 - p.life / p.maxLife);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.alpha, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
        ctx.globalAlpha = 1;

        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
        }
      }

      // Update falling grid bubbles physics animation loop
      const falling = fallingGridBubblesRef.current;
      for (let i = falling.length - 1; i >= 0; i--) {
        const fb = falling[i];
        fb.y += fb.vy;
        fb.vy += 0.25; // drop acceleration

        drawBubble(ctx, fb.x, fb.y, fb.color, fb.radius);

        if (fb.y > CANVAS_HEIGHT + 35) {
          falling.splice(i, 1);
        }
      }

      animFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [board, settings]);

  // Cannon Rendering Helper
  function drawCannon(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
    // Cannon Angle calculation from center
    const angleX = pointerXRef.current - cx;
    const angleY = pointerYRef.current - cy;
    let angle = Math.atan2(angleY, angleX);
    const MIN_ANGLE = -Math.PI + 0.15;
    const MAX_ANGLE = -0.15;
    if (angle > MAX_ANGLE && angle < Math.PI / 2) {
      angle = MAX_ANGLE;
    } else if (angle < MIN_ANGLE || angle >= Math.PI / 2) {
      angle = MIN_ANGLE;
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    // Draw Cannon barrel
    ctx.beginPath();
    ctx.rect(-10, -35, 20, 35);
    const grad = ctx.createLinearGradient(-10, 0, 10, 0);
    grad.addColorStop(0, '#475569');
    grad.addColorStop(0.5, '#94a3b8');
    grad.addColorStop(1, '#334155');
    ctx.fillStyle = grad;
    ctx.fill();

    // Metallic barrel lip
    ctx.beginPath();
    ctx.arc(0, -35, 10, 0, Math.PI, true);
    ctx.fillStyle = '#64748b';
    ctx.fill();

    ctx.restore();

    // Cannon gold baseline ring
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, Math.PI, true);
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();

    // Draw shooter bubble inside the pocket
    if (!activeShotRef.current) {
      let isPower = activePowerupRef.current;
      let powerColor = shooterColorRef.current;
      if (isPower === 'bomb') powerColor = 'charcoal';
      if (isPower === 'rainbow') powerColor = 'rainbow';
      drawBubble(ctx, cx, cy, powerColor, BUBBLE_RADIUS, isPower);
    }

    // Draw Preview text and secondary bubble
    ctx.font = 'bold 8px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText("NEXT", cx - 60, cy + 22);

    // Swap Ring button
    ctx.beginPath();
    ctx.arc(cx - 60, cy, 14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();

    drawBubble(ctx, cx - 60, cy, nextShooterColorRef.current, BUBBLE_RADIUS - 6);
  }

  // Draw generic, glossy bubble with Highlights
  function drawBubble(
    ctx: CanvasRenderingContext2D,
    bx: number,
    by: number,
    colorKey: string,
    r: number,
    powerup: PowerUpType | null = null
  ) {
    ctx.save();
    ctx.shadowBlur = 4;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';

    // Multi color setup
    const bubbleGradient = ctx.createRadialGradient(bx - r / 3, by - r / 3, r / 8, bx, by, r);

    if (colorKey === 'charcoal') {
      // Bomb color key
      bubbleGradient.addColorStop(0, '#64748b');
      bubbleGradient.addColorStop(0.8, '#1e293b');
      bubbleGradient.addColorStop(1, '#0f172a');
    } else if (colorKey === 'rainbow') {
      // Rainbow gradient rotation
      bubbleGradient.addColorStop(0, '#f43f5e');
      bubbleGradient.addColorStop(0.3, '#3b82f6');
      bubbleGradient.addColorStop(0.6, '#10b981');
      bubbleGradient.addColorStop(1, '#fbbf24');
    } else {
      const hex = COLOR_MAP[colorKey] || '#FFFFFF';
      bubbleGradient.addColorStop(0, '#ffffff');
      bubbleGradient.addColorStop(0.2, hex);
      bubbleGradient.addColorStop(0.9, hex);
      bubbleGradient.addColorStop(1, darkenColor(hex, 40));
    }

    ctx.beginPath();
    ctx.arc(bx, by, r - 0.5, 0, Math.PI * 2);
    ctx.fillStyle = bubbleGradient;
    ctx.fill();

    // Golden ring for active powerups
    if (powerup) {
      ctx.beginPath();
      ctx.arc(bx, by, r - 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.shadowBlur = 0;

    // Draw premium glossy reflections
    ctx.beginPath();
    ctx.arc(bx - r / 3.5, by - r / 3.5, r / 3.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fill();

    // Dynamic inner indicators or graphics
    if (colorKey === 'charcoal') {
      // Draw fire flame particle
      ctx.fillStyle = '#f97316';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText("\u2605", bx, by + 1);
    } else if (colorKey === 'rainbow') {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText("\u2736", bx, by);
    } else {
      // Small core bubble dot
      ctx.beginPath();
      ctx.arc(bx, by, r / 7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.fill();
    }

    ctx.restore();
  }

  // Pure darkener for 3D sphere gradient illusion
  function darkenColor(hex: string, percent: number) {
    let num = parseInt(hex.replace('#', ''), 16),
      amt = Math.round(2.55 * percent),
      R = (num >> 16) - amt,
      G = ((num >> 8) & 0x00ff) - amt,
      B = (num & 0x0000ff) - amt;
    return `rgb(${Math.max(0, R)}, ${Math.max(0, G)}, ${Math.max(0, B)})`;
  }

  // Pointer drag triggers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isPointerDownRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    updateAimPointer(e.clientX, e.clientY, rect);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    updateAimPointer(e.clientX, e.clientY, rect);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPointerDownRef.current) {
      isPointerDownRef.current = false;
      fireActiveBubble();
    }
  };

  return (
    <div className="flex flex-col items-center bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-700/50 p-3 max-w-full shadow-2xl">
      {/* Top Indicators Header */}
      <div className="flex justify-between items-center w-full mb-3 px-1 text-slate-100 font-sans">
        <div className="flex items-center gap-1.5 bg-slate-800/40 px-3 py-1.5 rounded-full border border-slate-700/30">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-slate-300">Target:</span>
          <span className="text-sm font-bold text-amber-400">{level.targetScore}</span>
        </div>

        <div className="flex items-center gap-2 bg-slate-800/40 px-3 py-1.5 rounded-full border border-slate-700/30">
          <Pause
            id="pause-game-btn"
            className="w-4 h-4 text-slate-300 hover:text-white cursor-pointer transition-colors"
            onClick={onPause}
          />
        </div>

        <div className="flex items-center gap-1.5 bg-rose-950/40 px-3 py-1.5 rounded-full border border-rose-900/20">
          <span className="text-xs font-semibold text-rose-300">Shots:</span>
          <span className="text-sm font-black text-rose-400">{shotsLeft}</span>
        </div>
      </div>

      {/* Target canvas container */}
      <div className="relative rounded-xl overflow-hidden border-2 border-slate-700/60 shadow-inner bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-900">
        <canvas
          id="bubble-shooter-canvas"
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="block touch-none cursor-crosshair z-10"
        />

        {/* Swipe overlay instruction */}
        {shotsLeft === level.maxShots && !activeShotRef.current && (
          <div className="absolute inset-x-0 bottom-24 flex justify-center pointer-events-none animate-bounce">
            <span className="bg-slate-950/80 backdrop-blur-sm text-xs font-medium text-slate-300 px-3 py-1.5 rounded-full border border-slate-800">
              Drag to AIM, Release to SHOOT 🚀
            </span>
          </div>
        )}
      </div>

      {/* Gun-controller quick selectors and helpers */}
      <div className="flex justify-between items-center w-full mt-3 px-1 gap-2">
        <button
          id="swap-bubbles-tool-btn"
          onClick={swapBubbles}
          className="flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white px-3 py-2 rounded-xl text-xs font-semibold border border-slate-700/50 active:scale-95 transition-all shadow-md"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Swapper
        </button>

        {/* Boost Shop buttons */}
        <div className="flex items-center gap-2">
          {/* Bomb booster */}
          <button
            id="shoot-bomb-powerup-btn"
            onClick={() => {
              if (activeShotRef.current) return;
              if (unlockedPowerups.bomb > 0) {
                if (activePowerup === 'bomb') {
                  setActivePowerup(null);
                } else {
                  setActivePowerup('bomb');
                  SoundManager.playClick(settings.sfxOn);
                }
              }
            }}
            disabled={unlockedPowerups.bomb <= 0}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              activePowerup === 'bomb'
                ? 'bg-amber-500 border-amber-400 text-slate-950 scale-105'
                : 'bg-slate-800/80 border-slate-700/50 text-slate-300 disabled:opacity-40'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            <span>Bomb ({unlockedPowerups.bomb})</span>
          </button>

          {/* Rainbow booster */}
          <button
            id="shoot-rainbow-powerup-btn"
            onClick={() => {
              if (activeShotRef.current) return;
              if (unlockedPowerups.rainbow > 0) {
                if (activePowerup === 'rainbow') {
                  setActivePowerup(null);
                } else {
                  setActivePowerup('rainbow');
                  SoundManager.playClick(settings.sfxOn);
                }
              }
            }}
            disabled={unlockedPowerups.rainbow <= 0}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              activePowerup === 'rainbow'
                ? 'bg-violet-600 border-violet-400 text-slate-100 scale-105'
                : 'bg-slate-800/80 border-slate-700/50 text-slate-300 disabled:opacity-40'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            <span>Rainbow ({unlockedPowerups.rainbow})</span>
          </button>

          {/* Guide guideLine booster */}
          <button
            id="guide-laser-powerup-btn"
            onClick={() => {
              if (activeShotRef.current) return;
              if (unlockedPowerups.guideLine > 0) {
                if (activePowerup === 'guideLine') {
                  setActivePowerup(null);
                } else {
                  setActivePowerup('guideLine');
                  SoundManager.playClick(settings.sfxOn);
                }
              }
            }}
            disabled={unlockedPowerups.guideLine <= 0}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              activePowerup === 'guideLine'
                ? 'bg-emerald-600 border-emerald-400 text-slate-100 scale-105'
                : 'bg-slate-800/80 border-slate-700/50 text-slate-300 disabled:opacity-40'
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-emerald-400" />
            <span>Aim ({unlockedPowerups.guideLine})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
