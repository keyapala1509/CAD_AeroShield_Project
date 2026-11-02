import React, { useEffect, useRef, useState } from 'react';
import { useTelemetry } from '../context/TelemetryContext';

const GRID_SIZE = 40;

export function TopoCanvas({ onSelectCell }) {
  const canvasRef = useRef(null);
  const [activeLayer, setActiveLayer] = useState('wind'); // 'wind' | 'rain' | 'combined'
  const [showVectors, setShowVectors] = useState(true);
  const [selectedCell, setSelectedCell] = useState({ x: 38, y: 68 });

  const { drones } = useTelemetry();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const cellSize = width / GRID_SIZE;

    // Simulation Data Arrays: 40x40 (1600 elements)
    const windGrid = new Float32Array(GRID_SIZE * GRID_SIZE);
    const rainGrid = new Float32Array(GRID_SIZE * GRID_SIZE);
    const windAngle = new Float32Array(GRID_SIZE * GRID_SIZE);

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const idx = y * GRID_SIZE + x;
        // Distance to storm center (26, 14)
        const dx = x - 26;
        const dy = y - 14;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Storm intensity calculation
        const stormIntensity = Math.max(0, 1 - dist / 18);
        windGrid[idx] = 4.0 + stormIntensity * 22.0 + (Math.sin(x * 0.4) * Math.cos(y * 0.4) * 3);
        rainGrid[idx] = stormIntensity > 0.15 ? stormIntensity * 14.2 : Math.abs(Math.sin(x * y)) * 0.8;
        // Wind angle vectors swirling toward SE
        windAngle[idx] = Math.PI * 1.25 + Math.sin(x + y) * 0.3;
      }
    }

    function getColorForValue(val, type) {
      if (type === 'wind') {
        if (val < 8) return 'rgba(30, 41, 59, 0.9)'; // Slate Calm
        if (val < 15) return 'rgba(6, 182, 212, 0.75)'; // Cyan Moderate
        if (val < 22) return 'rgba(245, 158, 11, 0.85)'; // Amber Warning
        return 'rgba(239, 68, 68, 0.95)'; // Crimson Hazard
      } else if (type === 'rain') {
        if (val < 1) return 'rgba(15, 23, 42, 0.85)';
        if (val < 4) return 'rgba(56, 189, 248, 0.6)';
        if (val < 9) return 'rgba(37, 99, 235, 0.8)';
        return 'rgba(147, 51, 234, 0.9)'; // Heavy Squall
      } else {
        const combined = Math.min(1, Math.max(0, val));
        if (combined < 0.25) return 'rgba(30, 41, 59, 0.9)';
        if (combined < 0.5) return 'rgba(6, 182, 212, 0.7)';
        if (combined < 0.75) return 'rgba(245, 158, 11, 0.85)';
        return 'rgba(239, 68, 68, 0.95)';
      }
    }

    ctx.clearRect(0, 0, width, height);

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const idx = y * GRID_SIZE + x;
        const px = x * cellSize;
        const py = y * cellSize;

        let cellColor = '#111827';
        if (activeLayer === 'wind') {
          cellColor = getColorForValue(windGrid[idx], 'wind');
        } else if (activeLayer === 'rain') {
          cellColor = getColorForValue(rainGrid[idx], 'rain');
        } else {
          const windNorm = Math.min(1, windGrid[idx] / 28);
          const rainNorm = Math.min(1, rainGrid[idx] / 15);
          const comb = windNorm * 0.6 + rainNorm * 0.4;
          cellColor = getColorForValue(comb, 'combined');
        }

        ctx.fillStyle = cellColor;
        ctx.fillRect(px, py, cellSize, cellSize);

        // Vector Arrows
        if (showVectors && x % 3 === 0 && y % 3 === 0) {
          const angle = windAngle[idx];
          const length = (windGrid[idx] / 28) * cellSize * 1.8;
          ctx.save();
          ctx.translate(px + cellSize / 2, py + cellSize / 2);
          ctx.rotate(angle);
          ctx.strokeStyle = 'rgba(223, 226, 238, 0.35)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(-length / 2, 0);
          ctx.lineTo(length / 2, 0);
          ctx.lineTo(length / 2 - 2, -2);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // Waypoint flight paths
    ctx.strokeStyle = 'rgba(78, 222, 163, 0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(20, 320);
    ctx.lineTo(180, 310);
    ctx.lineTo(340, 290);
    ctx.stroke();

    // D3 storm vector
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(340, 60);
    ctx.lineTo(240, 140);
    ctx.lineTo(120, 200);
    ctx.stroke();
    ctx.setLineDash([]);

    // Highlight selected inspector cell
    const selX = (selectedCell.x / 100) * GRID_SIZE;
    const selY = ((100 - selectedCell.y) / 100) * GRID_SIZE;
    ctx.strokeStyle = '#4cd7f6';
    ctx.lineWidth = 2;
    ctx.strokeRect(selX * cellSize - 1, selY * cellSize - 1, cellSize + 2, cellSize + 2);
  }, [activeLayer, showVectors, selectedCell]);

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const gridX = Math.floor((clickX / rect.width) * GRID_SIZE);
    const gridY = Math.floor((clickY / rect.height) * GRID_SIZE);

    const normX = Math.round((gridX / GRID_SIZE) * 100);
    const normY = 100 - Math.round((gridY / GRID_SIZE) * 100);

    const newCell = { x: normX, y: normY };
    setSelectedCell(newCell);

    // Calculate realistic inspected metrics based on position
    const dx = gridX - 26;
    const dy = gridY - 14;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const stormIntensity = Math.max(0, 1 - dist / 18);
    const windSpeed = (4.0 + stormIntensity * 22.0).toFixed(1);
    const gust = (windSpeed * 1.22).toFixed(1);
    const rain = (stormIntensity * 14.2).toFixed(1);
    const drag = (1.0 + (windSpeed / 28) * 0.55).toFixed(2);
    const penalty = Math.round((windSpeed / 28) * 36);

    if (onSelectCell) {
      onSelectCell({
        x: normX,
        y: normY,
        windSpeed,
        gust,
        rain,
        drag,
        penalty,
        squall: stormIntensity > 0.4 ? 'HEAVY SQUALL' : stormIntensity > 0.15 ? 'MODERATE RAIN' : 'CALM'
      });
    }
  };

  return (
    <div className="bg-surface-container p-space-sm rounded shadow-md flex flex-col gap-space-xs border border-outline-variant/30">
      {/* Controls & Switcher */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1 bg-surface-container-lowest p-0.5 rounded border border-outline-variant/30">
          <button
            onClick={() => setActiveLayer('wind')}
            className={`px-2 py-1 font-label-xs text-label-xs uppercase rounded transition-all font-mono ${
              activeLayer === 'wind' ? 'bg-primary text-on-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'
            }`}
            type="button"
          >
            Wind Velocity
          </button>
          <button
            onClick={() => setActiveLayer('rain')}
            className={`px-2 py-1 font-label-xs text-label-xs uppercase rounded transition-all font-mono ${
              activeLayer === 'rain' ? 'bg-primary text-on-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'
            }`}
            type="button"
          >
            Rain Matrix
          </button>
          <button
            onClick={() => setActiveLayer('combined')}
            className={`px-2 py-1 font-label-xs text-label-xs uppercase rounded transition-all font-mono ${
              activeLayer === 'combined' ? 'bg-primary text-on-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'
            }`}
            type="button"
          >
            Combined
          </button>
        </div>

        <button
          onClick={() => setShowVectors(!showVectors)}
          className={`h-6 px-1.5 bg-surface-container-high rounded flex items-center gap-1 border border-outline-variant/30 ${
            showVectors ? 'text-primary' : 'text-outline'
          }`}
          title="Toggle Vector Arrows"
          type="button"
        >
          <span className="material-symbols-outlined text-[14px]">navigation</span>
          <span className="font-label-xs text-label-xs font-mono">VECT</span>
        </button>
      </div>

      {/* Canvas Display */}
      <div className="relative w-full aspect-square bg-surface-container-lowest rounded overflow-hidden shadow-inner flex items-center justify-center border border-outline-variant/40">
        <canvas
          ref={canvasRef}
          width={360}
          height={360}
          onClick={handleCanvasClick}
          className="w-full h-full cursor-crosshair block"
        ></canvas>

        {/* Spatial Reticle Accent */}
        <div className="absolute top-2 left-2 pointer-events-none flex items-center gap-1 bg-surface-container-lowest/80 px-1.5 py-0.5 rounded border border-outline-variant/30">
          <span className="font-label-xs text-label-xs text-primary font-bold font-mono">GRID NW: 40x40</span>
          <span className="font-label-xs text-label-xs text-outline font-mono">| RES: 250m²</span>
        </div>

        {/* D3 In-flight Alert Badge Overlay */}
        <div
          className="absolute pointer-events-none transition-all duration-300"
          style={{ top: '38%', left: '68%', transform: 'translate(-50%, -50%)' }}
        >
          <div className="flex flex-col items-center">
            <span className="font-label-xs text-label-xs bg-error text-surface-container-lowest px-1 py-0.2 rounded font-bold shadow-md animate-pulse font-mono">
              D3 IN STORM
            </span>
            <div className="w-2.5 h-2.5 rounded-full bg-error border border-white"></div>
          </div>
        </div>

        {/* Sector Coordinates */}
        <div className="absolute bottom-2 right-2 pointer-events-none font-label-xs text-label-xs text-outline/60 bg-surface-container-lowest/80 px-1 py-0.5 rounded font-mono">
          LAT: 44.8291° N // LON: 08.4102° W
        </div>
      </div>

      {/* Dynamic Legend Scale */}
      <div className="flex flex-col gap-1 bg-surface-container-lowest p-space-xs rounded border border-outline-variant/20 font-mono">
        <div className="flex items-center justify-between text-outline font-label-xs text-label-xs">
          <span>0 m/s [CALM]</span>
          <span className="text-primary">12 m/s [MOD]</span>
          <span className="text-tertiary-container">18 m/s [HIGH]</span>
          <span className="text-error font-bold">28+ m/s [NO-GO]</span>
        </div>
        <div className="w-full h-2 rounded-full bg-gradient-to-r from-surface-variant via-primary via-tertiary-container to-error"></div>
      </div>
    </div>
  );
}
