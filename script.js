const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const results = document.getElementById('results');
const paletteGrid = document.getElementById('paletteGrid');
const mockup = document.getElementById('mockup');
const mockupTitle = document.getElementById('mockup-title');
const mockupText = document.getElementById('mockup-text');
const mockupBtn = document.getElementById('mockup-btn');
const contrastReport = document.getElementById('contrast-report');
const canvas = document.getElementById('processingCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

// UI Listeners
dropzone.onclick = () => fileInput.click();
fileInput.onchange = (e) => handleFile(e.target.files[0]);
dropzone.ondragover = (e) => { e.preventDefault(); dropzone.style.borderColor = 'var(--primary)'; };
dropzone.ondragleave = () => { dropzone.style.borderColor = '#ccc'; };
dropzone.ondrop = (e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0]);
};

function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            processImage(img);
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function processImage(img) {
    // Setup canvas to match image dimensions (downsampled for speed)
    const maxDim = 200;
    let w = img.width;
    let h = img.height;
    if (w > maxDim || h > maxDim) {
        const ratio = Math.min(maxDim / w, maxDim / h);
        w *= ratio;
        h *= ratio;
    }
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);

    const imageData = ctx.getImageData(0, 0, w, h).data;
    const pixels = [];
    
    // Sample pixels (every 4th pixel to improve performance)
    for (let i = 0; i < imageData.length; i += 16) {
        pixels.push([imageData[i], imageData[i+1], imageData[i+2]]);
    }

    const colors = kMeans(pixels, 6);
    displayPalette(colors);
}

// K-Means Clustering Implementation
function kMeans(pixels, k) {
    let centroids = pixels.slice(0, k); // Initial seeds
    let assignments = new Array(pixels.length);
    
    for (let iter = 0; iter < 10; iter++) {
        // Assignment Step
        for (let i = 0; i < pixels.length; i++) {
            let minDist = Infinity;
            for (let j = 0; j < k; j++) {
                const dist = Math.hypot(pixels[i][0] - centroids[j][0], pixels[i][1] - centroids[j][1], pixels[i][2] - centroids[j][2]);
                if (dist < minDist) {
                    minDist = dist;
                    assignments[i] = j;
                }
            }
        }

        // Update Step
        const newCentroids = Array.from({ length: k }, () => [0, 0, 0]);
        const counts = new Array(k).fill(0);
        for (let i = 0; i < pixels.length; i++) {
            const cluster = assignments[i];
            newCentroids[cluster][0] += pixels[i][0];
            newCentroids[cluster][1] += pixels[i][1];
            newCentroids[cluster][2] += pixels[i][2];
            counts[cluster]++;
        }
        for (let j = 0; j < k; j++) {
            if (counts[j] > 0) {
                centroids[j] = [newCentroids[j][0] / counts[j], newCentroids[j][1] / counts[j], newCentroids[j][2] / counts[j]];
            }
        }
    }
    return centroids.map(c => `rgb(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])})`);
}

function displayPalette(colors) {
    dropzone.classList.add('hidden');
    results.classList.remove('hidden');
    paletteGrid.innerHTML = '';

    // Assign roles logically
    // Primary: most dominant (index 0), Pop: highest saturation, Ink: darkest, Surface: lightest
    const roles = ['Primary', 'Secondary', 'Accent', 'Surface', 'Ink', 'Pop'];
    
    colors.forEach((color, i) => {
        const rgb = color.match(/\d+/g).map(Number);
        const hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
        
        const swatch = document.createElement('div');
        swatch.className = 'swatch';
        swatch.innerHTML = `
            <div class="color-box" style="background-color: ${color}"></div>
            <div class="swatch-info">
                ${roles[i]}
                <span class="hex-code">${hex}</span>
            </div>
            <button class="copy-btn" onclick="copyToClipboard('${hex}')">Copy</button>
        `;
        paletteGrid.appendChild(swatch);

        // Update dynamic variables for mockup
        if(i === 0) document.documentElement.style.setProperty('--primary', color);
        if(i === 2) document.documentElement.style.setProperty('--accent', color);
        if(i === 3) document.documentElement.style.setProperty('--surface', color);
        if(i === 4) document.documentElement.style.setProperty('--ink', color);
        if(i === 5) document.documentElement.style.setProperty('--pop', color);
    });

    updateMockup(colors);
}

function updateMockup(colors) {
    const primary = colors[0];
    const ink = colors[4];
    const surface = colors[3];
    const pop = colors[5];

    mockup.style.backgroundColor = surface;
    mockup.style.color = ink;
    mockupTitle.style.color = primary;
    mockupBtn.style.backgroundColor = pop;
    mockupBtn.style.color = '#fff';

    // Contrast Check (Primary vs Surface)
    const primaryRgb = primary.match(/\d+/g).map(Number);
    const surfaceRgb = surface.match(/\d+/g).map(Number);
    
    const contrast = getContrast(primaryRgb, surfaceRgb);
    contrastReport.innerHTML = `
        <strong>Accessibility Check:</strong><br>
        Primary vs Surface: ${contrast.toFixed(2)}:1 
        <span class="${contrast >= 4.5 ? 'pass' : 'fail'}">${contrast >= 4.5 ? 'PASS' : 'FAIL'}</span> 
        (WCAG AA requires 4.5:1)
    `;
}

// Utilities
function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    alert('Copied: ' + text);
}

function getLuminance(r, g, b) {
    let [rs, gs, bs] = [r, g, b].map(c => {
        c /= 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrast(rgb1, rgb2) {
    const l1 = getLuminance(...rgb1);
    const l2 = getLuminance(...rgb2);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
