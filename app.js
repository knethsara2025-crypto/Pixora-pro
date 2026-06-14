/**
 * Pixora Pro - Core Application Script
 * Highly optimized, vanilla JavaScript photo editor.
 */

// --- CORE LAYER CLASS ---
class Layer {
    constructor(id, name, width, height, type = 'paint') {
        this.id = id;
        this.name = name;
        this.type = type; // 'paint' | 'image' | 'text' | 'shape'
        
        // Transform attributes
        this.x = 0;
        this.y = 0;
        this.width = width;
        this.height = height;
        this.scaleX = 1.0;
        this.scaleY = 1.0;
        this.rotation = 0; // In degrees
        
        // Compositing attributes
        this.opacity = 1.0; // 0.0 to 1.0
        this.visible = true;
        this.blendMode = 'source-over';
        
        // Non-destructive adjustments
        this.adjustments = {
            brightness: 100, // 0 - 200%
            contrast: 100,   // 0 - 200%
            saturation: 100, // 0 - 200%
            hue: 0,          // 0 - 360 deg
            blur: 0,         // 0 - 20px
            grayscale: 0,    // 0 - 100%
            sepia: 0,        // 0 - 100%
            invert: 0        // 0 - 100%
        };
        
        // Offscreen canvas for buffer
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext('2d');
        
        // Text specific configuration
        this.textData = {
            text: 'Double-click to edit',
            fontSize: 48,
            fontFamily: 'Outfit, Inter, sans-serif',
            color: '#3b82f6',
            bold: false,
            italic: false
        };

        // Shape specific configuration
        this.shapeData = {
            type: 'rectangle', // 'rectangle' | 'ellipse'
            mode: 'fill',       // 'fill' | 'stroke' | 'both'
            strokeWidth: 3,
            strokeColor: '#000000',
            fillColor: '#3b82f6'
        };
    }
    
    // Generate standard CSS filter string
    getFilterString() {
        const adj = this.adjustments;
        return `brightness(${adj.brightness}%) ` +
               `contrast(${adj.contrast}%) ` +
               `saturate(${adj.saturation}%) ` +
               `hue-rotate(${adj.hue}deg) ` +
               `blur(${adj.blur}px) ` +
               `grayscale(${adj.grayscale}%) ` +
               `sepia(${adj.sepia}%) ` +
               `invert(${adj.invert}%)`;
    }
    
    // Deep clone layer
    clone() {
        const newLayer = new Layer(this.id, this.name, this.width, this.height, this.type);
        newLayer.x = this.x;
        newLayer.y = this.y;
        newLayer.scaleX = this.scaleX;
        newLayer.scaleY = this.scaleY;
        newLayer.rotation = this.rotation;
        newLayer.opacity = this.opacity;
        newLayer.visible = this.visible;
        newLayer.blendMode = this.blendMode;
        
        // Deep copy adjustments
        newLayer.adjustments = { ...this.adjustments };
        
        // Copy canvas content
        newLayer.ctx.drawImage(this.canvas, 0, 0);
        
        // Deep copy type-specific data
        newLayer.textData = { ...this.textData };
        newLayer.shapeData = { ...this.shapeData };
        
        return newLayer;
    }
}

// --- MAIN APPLICATION MANAGER ---
class PixoraApp {
    constructor() {
        // Document Dimensions
        this.width = 1200;
        this.height = 800;
        
        // Viewport Zoom & Pan
        this.scale = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.isPanning = false;
        this.panStartX = 0;
        this.panStartY = 0;
        
        // Layer management
        this.layers = [];
        this.activeLayerIndex = -1;
        this.layerIdCounter = 0;
        
        // Tools & Colors
        this.activeTool = 'move'; // 'move', 'brush', 'eraser', 'shape', 'text', 'eyedropper', 'pan'
        this.primaryColor = '#3b82f6';
        this.secondaryColor = '#ffffff';
        this.activeColorTarget = 'primary'; // 'primary' | 'secondary'
        
        // History management
        this.history = [];
        this.historyIndex = -1;
        this.maxHistoryStates = 25;
        
        // Tool drag state
        this.dragMode = 'none'; // 'none', 'move', 'rotate', 'resize-xx'
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragStartLayerX = 0;
        this.dragStartLayerY = 0;
        this.dragStartLayerScaleX = 1;
        this.dragStartLayerScaleY = 1;
        this.dragStartLayerRot = 0;
        this.dragStartWidth = 0;
        this.dragStartHeight = 0;
        this.resizeHandleId = '';
        
        // Brush/Drawing state
        this.isDrawing = false;
        this.lastDrawX = 0;
        this.lastDrawY = 0;
        
        // Dynamic shape creation state
        this.shapeStartX = 0;
        this.shapeStartY = 0;
        this.isCreatingShape = false;
        
        // UI Elements
        this.initElements();
        this.bindEvents();
        
        // Initialize with default canvas
        this.createNewDocument(1200, 800, 'transparent');
    }
    
    initElements() {
        // Viewport canvases
        this.viewportCanvas = document.getElementById('viewport-canvas');
        this.viewportCtx = this.viewportCanvas.getContext('2d');
        this.overlayCanvas = document.getElementById('overlay-canvas');
        this.overlayCtx = this.overlayCanvas.getContext('2d');
        
        this.canvasContainer = document.getElementById('canvas-container');
        this.canvasViewport = document.getElementById('canvas-viewport');
        
        // Toolbar
        this.toolButtons = {
            move: document.getElementById('tool-move'),
            brush: document.getElementById('tool-brush'),
            eraser: document.getElementById('tool-eraser'),
            shape: document.getElementById('tool-shape'),
            text: document.getElementById('tool-text'),
            eyedropper: document.getElementById('tool-eyedropper'),
            pan: document.getElementById('tool-pan')
        };
        
        // Color elements
        this.colorWells = {
            primary: document.getElementById('color-primary'),
            secondary: document.getElementById('color-secondary')
        };
        this.btnColorSwap = document.getElementById('btn-color-swap');
        this.nativeColorPicker = document.getElementById('native-color-picker');
        
        // Tool Options Groups
        this.optionGroups = {
            move: document.getElementById('options-move'),
            brush: document.getElementById('options-brush'),
            eraser: document.getElementById('options-eraser'),
            shape: document.getElementById('options-shape'),
            text: document.getElementById('options-text'),
            eyedropper: document.getElementById('options-eyedropper'),
            pan: document.getElementById('options-pan')
        };
        
        // Modals
        this.modals = {
            newDoc: document.getElementById('new-doc-modal'),
            shortcuts: document.getElementById('shortcuts-modal')
        };
    }
    
    // --- EVENT BINDING ---
    bindEvents() {
        // Window Resize
        window.addEventListener('resize', () => this.centerCanvasInViewport());
        
        // Disable default browser context menus on canvas
        this.overlayCanvas.addEventListener('contextmenu', e => e.preventDefault());
        
        // Menu item dropdowns (Toggle class active on click to hold open if needed, hover handles standard CSS layout)
        document.querySelectorAll('.menu-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                const parent = e.target.parentElement;
                parent.classList.toggle('active');
            });
        });
        
        // Dropdown Click Handlers
        document.getElementById('btn-new-doc').addEventListener('click', () => this.openModal('newDoc'));
        document.getElementById('btn-export-png').addEventListener('click', () => this.exportImage('png'));
        document.getElementById('btn-export-jpg').addEventListener('click', () => this.exportImage('jpeg'));
        document.getElementById('btn-undo').addEventListener('click', () => this.undo());
        document.getElementById('btn-redo').addEventListener('click', () => this.redo());
        document.getElementById('btn-shortcuts').addEventListener('click', () => this.openModal('shortcuts'));
        document.getElementById('btn-about').addEventListener('click', () => alert("Pixora Pro by Knethsara v1.0.0\nA premium canvas photo editor designed for power and speed."));
        
        // Open Image File import
        document.getElementById('input-open-image').addEventListener('change', e => {
            this.handleFileImport(e);
            e.target.value = ''; // Reset
        });
        document.getElementById('btn-add-image-layer').addEventListener('change', e => {
            this.handleFileImport(e);
            e.target.value = ''; // Reset
        });
        
        // Toolbar tool switching
        Object.keys(this.toolButtons).forEach(toolName => {
            this.toolButtons[toolName].addEventListener('click', () => this.setTool(toolName));
        });
        
        // Color controls
        this.colorWells.primary.addEventListener('click', () => this.openColorPicker('primary'));
        this.colorWells.secondary.addEventListener('click', () => this.openColorPicker('secondary'));
        this.btnColorSwap.addEventListener('click', () => this.swapColors());
        this.nativeColorPicker.addEventListener('change', e => this.handleColorPickerChange(e));
        
        // Layer Operations
        document.getElementById('btn-add-layer').addEventListener('click', () => this.addNewPaintLayer());
        document.getElementById('btn-duplicate-layer').addEventListener('click', () => this.duplicateActiveLayer());
        document.getElementById('btn-delete-layer').addEventListener('click', () => this.deleteActiveLayer());
        document.getElementById('btn-layer-up').addEventListener('click', () => this.moveActiveLayer('up'));
        document.getElementById('btn-layer-down').addEventListener('click', () => this.moveActiveLayer('down'));
        
        // Clear active layer menu options
        document.getElementById('btn-clear-layer').addEventListener('click', () => this.clearActiveLayer());
        document.getElementById('btn-delete-active-layer').addEventListener('click', () => this.deleteActiveLayer());
        
        // Blend Mode & Opacity
        document.getElementById('layer-blend-mode').addEventListener('change', e => {
            const active = this.getActiveLayer();
            if (active) {
                this.saveHistoryState('Change Blend Mode');
                active.blendMode = e.target.value;
                this.render();
            }
        });
        
        const opacityInput = document.getElementById('layer-opacity-input');
        const opacityVal = document.getElementById('layer-opacity-val');
        opacityInput.addEventListener('input', e => {
            const active = this.getActiveLayer();
            if (active) {
                active.opacity = e.target.value / 100;
                opacityVal.textContent = `${e.target.value}%`;
                this.render();
            }
        });
        opacityInput.addEventListener('change', () => {
            this.saveHistoryState('Change Opacity');
        });
        
        // Zoom sliders
        const zoomSlider = document.getElementById('zoom-slider');
        zoomSlider.addEventListener('input', e => {
            this.setZoom(e.target.value / 100);
        });
        document.getElementById('btn-zoom-in-ctrl').addEventListener('click', () => this.zoomStep(0.1));
        document.getElementById('btn-zoom-out-ctrl').addEventListener('click', () => this.zoomStep(-0.1));
        
        document.getElementById('btn-zoom-fit-tag').addEventListener('click', () => this.zoomToFit());
        document.getElementById('btn-zoom-100-tag').addEventListener('click', () => this.setZoom(1.0));
        document.getElementById('btn-zoom-200-tag').addEventListener('click', () => this.setZoom(2.0));
        
        // Navigator Options Bar shortcuts
        document.getElementById('btn-opt-fit').addEventListener('click', () => this.zoomToFit());
        document.getElementById('btn-opt-reset').addEventListener('click', () => this.setZoom(1.0));
        
        // Adjustments Sliders
        const adjustmentKeys = ['brightness', 'contrast', 'saturation', 'hue', 'blur', 'grayscale', 'sepia', 'invert'];
        adjustmentKeys.forEach(key => {
            const slider = document.getElementById(`adj-${key}`);
            const display = document.getElementById(`val-${key}`);
            
            slider.addEventListener('input', e => {
                const active = this.getActiveLayer();
                if (active) {
                    active.adjustments[key] = parseFloat(e.target.value);
                    
                    // Format display value
                    let suffix = '%';
                    if (key === 'hue') suffix = '°';
                    if (key === 'blur') suffix = 'px';
                    display.textContent = `${e.target.value}${suffix}`;
                    
                    this.render();
                }
            });
            
            // Push history snapshot on change commit
            slider.addEventListener('change', () => {
                this.saveHistoryState(`Adjust ${key.charAt(0).toUpperCase() + key.slice(1)}`);
            });
        });
        
        document.getElementById('btn-reset-adjustments').addEventListener('click', () => {
            const active = this.getActiveLayer();
            if (active) {
                this.saveHistoryState('Reset Adjustments');
                active.adjustments = { brightness: 100, contrast: 100, saturation: 100, hue: 0, blur: 0, grayscale: 0, sepia: 0, invert: 0 };
                this.syncAdjustmentsPanel(active);
                this.render();
            }
        });
        
        // Modals Buttons
        document.getElementById('btn-close-new-modal').addEventListener('click', () => this.closeModal('newDoc'));
        document.getElementById('btn-cancel-new-doc').addEventListener('click', () => this.closeModal('newDoc'));
        document.getElementById('btn-create-doc').addEventListener('click', () => this.handleCreateNewDocument());
        
        document.getElementById('btn-close-shortcuts-modal').addEventListener('click', () => this.closeModal('shortcuts'));
        document.getElementById('btn-close-shortcuts-ok').addEventListener('click', () => this.closeModal('shortcuts'));
        
        // Preset dimensions selection in New Doc modal
        document.getElementById('new-doc-presets').addEventListener('change', e => {
            const val = e.target.value;
            if (val !== 'custom') {
                const [w, h] = val.split('x').map(Number);
                document.getElementById('new-doc-width').value = w;
                document.getElementById('new-doc-height').value = h;
            }
        });
        
        // Custom Text Options changes
        const textVal = document.getElementById('opt-text-val');
        const textSize = document.getElementById('opt-text-size');
        const textFont = document.getElementById('opt-text-font');
        const textBold = document.getElementById('opt-text-bold');
        const textItalic = document.getElementById('opt-text-italic');
        
        const updateActiveTextLayer = () => {
            const active = this.getActiveLayer();
            if (active && active.type === 'text') {
                active.textData.text = textVal.value;
                active.textData.fontSize = parseInt(textSize.value);
                active.textData.fontFamily = textFont.value;
                active.textData.bold = textBold.classList.contains('active');
                active.textData.italic = textItalic.classList.contains('active');
                active.textData.color = this.primaryColor;
                
                this.updateTextLayerCanvas(active);
                this.render();
            }
        };
        
        [textVal, textSize, textFont].forEach(el => {
            el.addEventListener('input', updateActiveTextLayer);
            el.addEventListener('change', () => this.saveHistoryState('Edit Text Layer'));
        });
        
        textBold.addEventListener('click', () => {
            textBold.classList.toggle('active');
            updateActiveTextLayer();
            this.saveHistoryState('Toggle Text Bold');
        });
        
        textItalic.addEventListener('click', () => {
            textItalic.classList.toggle('active');
            updateActiveTextLayer();
            this.saveHistoryState('Toggle Text Italic');
        });
        
        // Shape Tool Option Changes
        const strokeWidthSlider = document.getElementById('opt-shape-stroke-width');
        strokeWidthSlider.addEventListener('input', e => {
            document.getElementById('opt-shape-stroke-width-val').textContent = `${e.target.value}px`;
            const active = this.getActiveLayer();
            if (active && active.type === 'shape') {
                active.shapeData.strokeWidth = parseInt(e.target.value);
                this.drawShapeOnLayer(active);
                this.render();
            }
        });
        strokeWidthSlider.addEventListener('change', () => this.saveHistoryState('Edit Shape Stroke Width'));
        
        document.getElementById('opt-shape-type').addEventListener('change', e => {
            const active = this.getActiveLayer();
            if (active && active.type === 'shape') {
                active.shapeData.type = e.target.value;
                this.drawShapeOnLayer(active);
                this.render();
                this.saveHistoryState('Edit Shape Type');
            }
        });
        
        document.getElementById('opt-shape-mode').addEventListener('change', e => {
            const active = this.getActiveLayer();
            if (active && active.type === 'shape') {
                active.shapeData.mode = e.target.value;
                this.drawShapeOnLayer(active);
                this.render();
                this.saveHistoryState('Edit Shape Mode');
            }
        });
        
        document.getElementById('shape-stroke-color').addEventListener('click', () => {
            this.openColorPicker('stroke');
        });
        
        // Bounding Box Reset Transforms button
        document.getElementById('btn-reset-transform').addEventListener('click', () => {
            const active = this.getActiveLayer();
            if (active) {
                this.saveHistoryState('Reset Transforms');
                active.x = Math.round((this.width - active.width) / 2);
                active.y = Math.round((this.height - active.height) / 2);
                active.scaleX = 1.0;
                active.scaleY = 1.0;
                active.rotation = 0;
                this.syncTransformOptions(active);
                this.render();
            }
        });
        
        // Transform Options Manual Inputs
        const optMoveX = document.getElementById('opt-move-x');
        const optMoveY = document.getElementById('opt-move-y');
        const optMoveRot = document.getElementById('opt-move-rot');
        
        const handleManualTransform = () => {
            const active = this.getActiveLayer();
            if (active) {
                active.x = parseInt(optMoveX.value) || 0;
                active.y = parseInt(optMoveY.value) || 0;
                active.rotation = parseInt(optMoveRot.value) || 0;
                document.getElementById('opt-move-rot-val').textContent = `${active.rotation}°`;
                this.render();
            }
        };
        
        [optMoveX, optMoveY].forEach(el => {
            el.addEventListener('input', handleManualTransform);
            el.addEventListener('change', () => this.saveHistoryState('Manual Position Edit'));
        });
        
        optMoveRot.addEventListener('input', e => {
            const active = this.getActiveLayer();
            if (active) {
                active.rotation = parseInt(e.target.value);
                document.getElementById('opt-move-rot-val').textContent = `${e.target.value}°`;
                this.render();
            }
        });
        optMoveRot.addEventListener('change', () => this.saveHistoryState('Manual Rotation Edit'));

        // Workspace Zoom & Pan interaction (Pointer based)
        this.canvasViewport.addEventListener('mousedown', e => this.handleWorkspaceMouseDown(e));
        window.addEventListener('mousemove', e => this.handleWorkspaceMouseMove(e));
        window.addEventListener('mouseup', e => this.handleWorkspaceMouseUp(e));
        
        // Mousewheel zoom on canvas viewport
        this.canvasViewport.addEventListener('wheel', e => {
            e.preventDefault();
            const zoomFactor = 1.1;
            const newZoom = e.deltaY < 0 ? this.scale * zoomFactor : this.scale / zoomFactor;
            this.setZoom(newZoom);
        });
        
        // Spacebar holding to toggle Hand tool temporarily
        window.addEventListener('keydown', e => {
            if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
                e.preventDefault();
                if (this.activeTool !== 'pan') {
                    this.previousToolBeforeSpace = this.activeTool;
                    this.setTool('pan');
                }
            }
            // Keyboard Shortcuts
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
                const key = e.key.toLowerCase();
                
                // Tool Shortcuts
                if (key === 'v') this.setTool('move');
                if (key === 'b') this.setTool('brush');
                if (key === 'e') this.setTool('eraser');
                if (key === 'u') this.setTool('shape');
                if (key === 't') this.setTool('text');
                if (key === 'i') this.setTool('eyedropper');
                if (key === 'h') this.setTool('pan');
                if (key === 'x') this.swapColors();
                
                // Edit Shortcuts
                if (e.ctrlKey && key === 'z') {
                    e.preventDefault();
                    this.undo();
                }
                if (e.ctrlKey && key === 'y') {
                    e.preventDefault();
                    this.redo();
                }
                if (e.ctrlKey && key === 'd') {
                    e.preventDefault();
                    this.duplicateActiveLayer();
                }
                
                // Zoom shortcuts
                if (e.ctrlKey && e.key === '=') {
                    e.preventDefault();
                    this.zoomStep(0.1);
                }
                if (e.ctrlKey && e.key === '-') {
                    e.preventDefault();
                    this.zoomStep(-0.1);
                }
                
                // Delete shortcut
                if (e.key === 'Delete' || e.key === 'Backspace') {
                    // Check if renaming input is active
                    if (document.activeElement.tagName !== 'INPUT') {
                        this.deleteActiveLayer();
                    }
                }
            }
        });
        
        window.addEventListener('keyup', e => {
            if (e.code === 'Space' && this.previousToolBeforeSpace) {
                this.setTool(this.previousToolBeforeSpace);
                this.previousToolBeforeSpace = null;
            }
        });

        document.getElementById('btn-clear-history').addEventListener('click', () => {
            if (confirm("Are you sure you want to clear the undo history?")) {
                const currentSnapshot = this.takeSnapshot();
                currentSnapshot.description = "Clear History";
                this.history = [currentSnapshot];
                this.historyIndex = 0;
                this.updateHistoryUI();
            }
        });
    }
    
    // --- WORKSPACE COORDINATES TRANSLATION ---
    // Converts a screen mouse coordinates (clientX, clientY) to local document coordinates
    getCanvasCoordinates(clientX, clientY) {
        const rect = this.overlayCanvas.getBoundingClientRect();
        
        // This math matches screen boundaries directly to document dimensions (e.g. 1200x800)
        // regardless of CSS zoom levels or translations.
        const canvasX = (clientX - rect.left) * (this.width / rect.width);
        const canvasY = (clientY - rect.top) * (this.height / rect.height);
        
        return {
            x: Math.round(canvasX),
            y: Math.round(canvasY)
        };
    }
    
    // Converts canvas coordinates to local layer-relative coordinates
    // (Translates position, rotates backwards, and scales backwards)
    getLayerLocalCoordinates(canvasX, canvasY, layer) {
        // Find center of layer in canvas space
        const cx = layer.x + layer.width / 2;
        const cy = layer.y + layer.height / 2;
        
        // Translate coordinates relative to layer center
        let tx = canvasX - cx;
        let ty = canvasY - cy;
        
        // Rotate backwards around center
        const rad = -layer.rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const rx = tx * cos - ty * sin;
        const ry = tx * sin + ty * cos;
        
        // Scale backwards and shift relative to top-left corner
        const lx = rx / layer.scaleX + layer.width / 2;
        const ly = ry / layer.scaleY + layer.height / 2;
        
        return {
            x: Math.round(lx),
            y: Math.round(ly)
        };
    }
    
    // --- MODAL UTILITIES ---
    openModal(modalName) {
        this.modals[modalName].classList.add('active');
    }
    
    closeModal(modalName) {
        this.modals[modalName].classList.remove('active');
    }
    
    // --- TOOL STATE ENGINE ---
    setTool(toolName) {
        this.activeTool = toolName;
        
        // Toggle toolbar UI active classes
        Object.keys(this.toolButtons).forEach(name => {
            this.toolButtons[name].classList.toggle('active', name === toolName);
        });
        
        // Toggle options bar options groups
        Object.keys(this.optionGroups).forEach(name => {
            this.optionGroups[name].classList.toggle('active', name === toolName);
        });
        
        // Sync active tool attributes if needed
        const active = this.getActiveLayer();
        if (toolName === 'text') {
            const textVal = document.getElementById('opt-text-val');
            if (active && active.type === 'text') {
                textVal.value = active.textData.text;
                document.getElementById('opt-text-size').value = active.textData.fontSize;
                document.getElementById('opt-text-font').value = active.textData.fontFamily;
                document.getElementById('opt-text-bold').classList.toggle('active', active.textData.bold);
                document.getElementById('opt-text-italic').classList.toggle('active', active.textData.italic);
            }
        }
        
        this.renderOverlay();
    }
    
    // --- COLOR PICKER SYSTEM ---
    openColorPicker(target) {
        this.activeColorTarget = target; // 'primary' | 'secondary' | 'stroke'
        
        // Set native picker value to target color
        if (target === 'primary') {
            this.nativeColorPicker.value = this.primaryColor;
        } else if (target === 'secondary') {
            this.nativeColorPicker.value = this.secondaryColor;
        } else if (target === 'stroke') {
            const active = this.getActiveLayer();
            if (active && active.type === 'shape') {
                this.nativeColorPicker.value = active.shapeData.strokeColor;
            }
        }
        
        this.nativeColorPicker.click();
    }
    
    handleColorPickerChange(e) {
        const hex = e.target.value;
        
        if (this.activeColorTarget === 'primary') {
            this.primaryColor = hex;
            this.colorWells.primary.style.backgroundColor = hex;
            // Update eyedropper preview
            document.getElementById('eyedropper-preview').style.backgroundColor = hex;
            document.getElementById('eyedropper-preview-hex').textContent = hex.toUpperCase();
            
            // If active text layer, update color dynamically
            const active = this.getActiveLayer();
            if (active && active.type === 'text') {
                active.textData.color = hex;
                this.updateTextLayerCanvas(active);
                this.render();
                this.saveHistoryState('Change Text Color');
            }
            // If active shape, update fill color
            if (active && active.type === 'shape') {
                active.shapeData.fillColor = hex;
                this.drawShapeOnLayer(active);
                this.render();
                this.saveHistoryState('Change Shape Fill');
            }
        } else if (this.activeColorTarget === 'secondary') {
            this.secondaryColor = hex;
            this.colorWells.secondary.style.backgroundColor = hex;
        } else if (this.activeColorTarget === 'stroke') {
            const active = this.getActiveLayer();
            if (active && active.type === 'shape') {
                active.shapeData.strokeColor = hex;
                document.getElementById('shape-stroke-color').style.backgroundColor = hex;
                this.drawShapeOnLayer(active);
                this.render();
                this.saveHistoryState('Change Shape Stroke Color');
            }
        }
    }
    
    swapColors() {
        const temp = this.primaryColor;
        this.primaryColor = this.secondaryColor;
        this.secondaryColor = temp;
        
        this.colorWells.primary.style.backgroundColor = this.primaryColor;
        this.colorWells.secondary.style.backgroundColor = this.secondaryColor;
        
        document.getElementById('eyedropper-preview').style.backgroundColor = this.primaryColor;
        document.getElementById('eyedropper-preview-hex').textContent = this.primaryColor.toUpperCase();
    }
    
    // --- WORKSPACE POINTER INTERACTIONS ---
    handleWorkspaceMouseDown(e) {
        const coords = this.getCanvasCoordinates(e.clientX, e.clientY);
        
        // --- 1. PAN TOOL ---
        if (this.activeTool === 'pan' || e.button === 1) {
            this.isPanning = true;
            this.panStartX = e.clientX - this.panX;
            this.panStartY = e.clientY - this.panY;
            this.canvasViewport.style.cursor = 'grabbing';
            return;
        }
        
        // --- 2. MOVE TOOL ---
        if (this.activeTool === 'move') {
            const active = this.getActiveLayer();
            
            if (active && active.visible) {
                // Check if pointer hit transform handle
                const handle = this.getHitTransformHandle(coords.x, coords.y, active);
                if (handle) {
                    this.dragMode = handle; // e.g. 'resize-tl', 'rotate'
                    this.dragStartX = coords.x;
                    this.dragStartY = coords.y;
                    this.dragStartLayerX = active.x;
                    this.dragStartLayerY = active.y;
                    this.dragStartLayerScaleX = active.scaleX;
                    this.dragStartLayerScaleY = active.scaleY;
                    this.dragStartLayerRot = active.rotation;
                    this.dragStartWidth = active.width;
                    this.dragStartHeight = active.height;
                    
                    // Create deep clone for undo snapshot before drag changes
                    this.preTransformSnapshot = this.takeSnapshot();
                    return;
                }
                
                // Check if clicked inside layer bounding box
                if (this.isPointInsideLayerBoundingBox(coords.x, coords.y, active)) {
                    this.dragMode = 'move';
                    this.dragStartX = coords.x;
                    this.dragStartY = coords.y;
                    this.dragStartLayerX = active.x;
                    this.dragStartLayerY = active.y;
                    
                    // Save history state snapshot before move
                    this.preTransformSnapshot = this.takeSnapshot();
                    return;
                }
            }
            
            // If we clicked elsewhere, let's select layer under coordinate (Top-to-Bottom)
            for (let i = this.layers.length - 1; i >= 0; i--) {
                const layer = this.layers[i];
                if (layer.visible && this.isPointInsideLayerBoundingBox(coords.x, coords.y, layer)) {
                    this.selectLayer(i);
                    // Start drag immediately
                    this.dragMode = 'move';
                    this.dragStartX = coords.x;
                    this.dragStartY = coords.y;
                    this.dragStartLayerX = layer.x;
                    this.dragStartLayerY = layer.y;
                    this.preTransformSnapshot = this.takeSnapshot();
                    return;
                }
            }
            
            // Deselect layer
            this.selectLayer(-1);
        }
        
        // --- 3. BRUSH / ERASER TOOL ---
        if (this.activeTool === 'brush' || this.activeTool === 'eraser') {
            const active = this.getActiveLayer();
            if (!active) {
                alert("Please select or create an editable Paint Layer first.");
                return;
            }
            if (active.type !== 'paint' && active.type !== 'image') {
                alert("Drawing is only allowed on Paint or Image Layers. Text and Shape layers are vector-based.");
                return;
            }
            if (!active.visible) return;
            
            this.isDrawing = true;
            this.saveHistoryState(this.activeTool === 'brush' ? 'Brush Stroke' : 'Eraser Stroke');
            
            // Get layer local coordinates
            const local = this.getLayerLocalCoordinates(coords.x, coords.y, active);
            this.lastDrawX = local.x;
            this.lastDrawY = local.y;
            
            this.drawOnActiveLayer(local.x, local.y, local.x, local.y);
        }
        
        // --- 4. SHAPE TOOL (DRAG TO CREATE) ---
        if (this.activeTool === 'shape') {
            this.isCreatingShape = true;
            this.shapeStartX = coords.x;
            this.shapeStartY = coords.y;
            this.shapeEndX = coords.x;
            this.shapeEndY = coords.y;
        }
        
        // --- 5. TEXT TOOL ---
        if (this.activeTool === 'text') {
            // Check if clicked inside existing text layer to edit it
            const active = this.getActiveLayer();
            if (active && active.type === 'text' && this.isPointInsideLayerBoundingBox(coords.x, coords.y, active)) {
                // Edit active
                document.getElementById('opt-text-val').focus();
                return;
            }
            
            // Else, create new text layer at coordinates
            this.createNewTextLayer(coords.x - 100, coords.y - 24);
        }
        
        // --- 6. EYEDROPPER TOOL ---
        if (this.activeTool === 'eyedropper') {
            this.samplePixelColor(coords.x, coords.y);
        }
    }
    
    handleWorkspaceMouseMove(e) {
        const coords = this.getCanvasCoordinates(e.clientX, e.clientY);
        
        // --- 1. PAN ACTIVE ---
        if (this.isPanning) {
            this.panX = e.clientX - this.panStartX;
            this.panY = e.clientY - this.panStartY;
            this.updateCanvasTransforms();
            return;
        }
        
        // --- 2. MOVE/TRANSFORM DRAGS ---
        if (this.dragMode !== 'none') {
            const active = this.getActiveLayer();
            if (!active) return;
            
            const dx = coords.x - this.dragStartX;
            const dy = coords.y - this.dragStartY;
            
            if (this.dragMode === 'move') {
                active.x = Math.round(this.dragStartLayerX + dx);
                active.y = Math.round(this.dragStartLayerY + dy);
                this.syncTransformOptions(active);
            }
            
            else if (this.dragMode === 'rotate') {
                // Rotation around layer center
                const cx = this.dragStartLayerX + this.dragStartWidth / 2;
                const cy = this.dragStartLayerY + this.dragStartHeight / 2;
                
                const startAngle = Math.atan2(this.dragStartY - cy, this.dragStartX - cx);
                const currentAngle = Math.atan2(coords.y - cy, coords.x - cx);
                
                let angleDiff = (currentAngle - startAngle) * 180 / Math.PI;
                active.rotation = Math.round((this.dragStartLayerRot + angleDiff) % 360);
                this.syncTransformOptions(active);
            }
            
            else if (this.dragMode.startsWith('resize-')) {
                // Simplify scale calculations: Scale from center coordinates
                // Translate mouse vector into local layer coordinates relative to center
                const cx = this.dragStartLayerX + this.dragStartWidth / 2;
                const cy = this.dragStartLayerY + this.dragStartHeight / 2;
                
                const rad = -this.dragStartLayerRot * Math.PI / 180;
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);
                
                // Mouse coordinates relative to center in local coordinates
                const localStartX = (this.dragStartX - cx) * cos - (this.dragStartY - cy) * sin;
                const localStartY = (this.dragStartX - cx) * sin + (this.dragStartY - cy) * cos;
                
                const localCurrentX = (coords.x - cx) * cos - (coords.y - cy) * sin;
                const localCurrentY = (coords.x - cx) * sin + (coords.y - cy) * cos;
                
                const handle = this.dragMode.split('-')[1];
                let scaleFactorX = 1;
                let scaleFactorY = 1;
                
                // Check which handles we drag
                if (handle.includes('r')) scaleFactorX = localCurrentX / localStartX;
                if (handle.includes('l')) scaleFactorX = localCurrentX / localStartX; // Center symmetric
                if (handle.includes('b')) scaleFactorY = localCurrentY / localStartY;
                if (handle.includes('t')) scaleFactorY = localCurrentY / localStartY;
                
                // Limit scale sizes
                active.scaleX = Math.max(0.05, this.dragStartLayerScaleX * scaleFactorX);
                active.scaleY = Math.max(0.05, this.dragStartLayerScaleY * scaleFactorY);
                
                // Uniform scaling constraint if Shift key held
                if (e.shiftKey) {
                    const avg = (active.scaleX + active.scaleY) / 2;
                    active.scaleX = avg;
                    active.scaleY = avg;
                }
                
                this.syncTransformOptions(active);
            }
            
            this.render();
            return;
        }
        
        // --- 3. BRUSH / ERASER DRAGGING ---
        if (this.isDrawing) {
            const active = this.getActiveLayer();
            if (active) {
                const local = this.getLayerLocalCoordinates(coords.x, coords.y, active);
                this.drawOnActiveLayer(this.lastDrawX, this.lastDrawY, local.x, local.y);
                this.lastDrawX = local.x;
                this.lastDrawY = local.y;
            }
            return;
        }
        
        // --- 4. SHAPE CREATION GUIDE DRAG ---
        if (this.isCreatingShape) {
            this.shapeEndX = coords.x;
            this.shapeEndY = coords.y;
            this.renderOverlay();
            return;
        }
    }
    
    handleWorkspaceMouseUp(e) {
        // Finalize Pan
        if (this.isPanning) {
            this.isPanning = false;
            this.canvasViewport.style.cursor = 'default';
            return;
        }
        
        // Finalize Bounding box transform drags
        if (this.dragMode !== 'none') {
            this.dragMode = 'none';
            // Commit deep snapshot to history stack if movement occurred
            if (this.preTransformSnapshot) {
                const active = this.getActiveLayer();
                const dx = active.x - this.dragStartLayerX;
                const dy = active.y - this.dragStartLayerY;
                const dr = active.rotation - this.dragStartLayerRot;
                const dsx = active.scaleX - this.dragStartLayerScaleX;
                const dsy = active.scaleY - this.dragStartLayerScaleY;
                
                if (dx !== 0 || dy !== 0 || dr !== 0 || dsx !== 0 || dsy !== 0) {
                    // Inject transform action message
                    this.preTransformSnapshot.description = 'Transform Layer';
                    this.pushHistorySnapshot(this.preTransformSnapshot);
                }
                this.preTransformSnapshot = null;
            }
            
            // Re-render thumbnails in layers pane
            this.updateLayersUI();
            this.render();
            return;
        }
        
        // Finalize Brush/Drawing strokes
        if (this.isDrawing) {
            this.isDrawing = false;
            this.updateLayersUI();
            return;
        }
        
        // Finalize Shape creation
        if (this.isCreatingShape) {
            this.isCreatingShape = false;
            
            const w = Math.abs(this.shapeEndX - this.shapeStartX);
            const h = Math.abs(this.shapeEndY - this.shapeStartY);
            
            // Limit minimal size to prevent tiny shapes
            if (w > 5 || h > 5) {
                const x = Math.min(this.shapeStartX, this.shapeEndX);
                const y = Math.min(this.shapeStartY, this.shapeEndY);
                
                this.createNewShapeLayer(x, y, w, h);
            }
            this.renderOverlay();
        }
    }
    
    // --- CANVAS TRANSFORMS FOR PAN/ZOOM ---
    updateCanvasTransforms() {
        this.canvasContainer.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
        
        // Update zoom inputs
        document.getElementById('zoom-slider').value = Math.round(this.scale * 100);
        document.getElementById('zoom-percentage-text').textContent = `${Math.round(this.scale * 100)}%`;
    }
    
    setZoom(z) {
        // Clamp zoom bounds between 10% and 600%
        this.scale = Math.max(0.1, Math.min(6.0, z));
        this.updateCanvasTransforms();
    }
    
    zoomStep(delta) {
        this.setZoom(this.scale + delta);
    }
    
    zoomToFit() {
        const containerRect = this.canvasViewport.getBoundingClientRect();
        
        // Calculate fit multiplier with 40px margin padding
        const scaleW = (containerRect.width - 80) / this.width;
        const scaleH = (containerRect.height - 80) / this.height;
        
        const fitScale = Math.min(scaleW, scaleH, 1.2); // Cap fit at 120%
        
        this.scale = fitScale;
        this.panX = 0;
        this.panY = 0;
        
        this.updateCanvasTransforms();
        this.centerCanvasInViewport();
    }
    
    centerCanvasInViewport() {
        // Re-center translation offset in viewport
        this.panX = 0;
        this.panY = 0;
        this.updateCanvasTransforms();
    }
    
    // --- TEXT LAYER RE-RENDER ENGINE ---
    updateTextLayerCanvas(layer) {
        const textData = layer.textData;
        const tempCtx = this.overlayCtx; // Use temporary measurement
        
        const fontStyle = `${textData.italic ? 'italic ' : ''}${textData.bold ? 'bold ' : ''}${textData.fontSize}px ${textData.fontFamily}`;
        tempCtx.font = fontStyle;
        
        const metrics = tempCtx.measureText(textData.text);
        const textWidth = Math.max(metrics.width, 10);
        const textHeight = textData.fontSize * 1.3;
        
        // Resize layer offscreen canvas size to frame text
        layer.canvas.width = Math.ceil(textWidth + 40);
        layer.canvas.height = Math.ceil(textHeight + 40);
        layer.width = layer.canvas.width;
        layer.height = layer.canvas.height;
        
        // Render
        const ctx = layer.ctx;
        ctx.clearRect(0, 0, layer.width, layer.height);
        
        ctx.font = fontStyle;
        ctx.fillStyle = textData.color;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        
        // Draw text in middle of layer
        ctx.fillText(textData.text, layer.width / 2, layer.height / 2);
        
        this.updateLayersUI();
    }
    
    // --- SHAPE LAYER RE-RENDER ENGINE ---
    drawShapeOnLayer(layer) {
        const ctx = layer.ctx;
        const shape = layer.shapeData;
        const strokeW = shape.strokeWidth;
        
        ctx.clearRect(0, 0, layer.width, layer.height);
        ctx.beginPath();
        
        // Bounding box size for geometry calculations
        const rx = strokeW;
        const ry = strokeW;
        const rw = layer.width - strokeW * 2;
        const rh = layer.height - strokeW * 2;
        
        if (shape.type === 'rectangle') {
            ctx.rect(rx, ry, rw, rh);
        } else if (shape.type === 'ellipse') {
            ctx.ellipse(rx + rw / 2, ry + rh / 2, rw / 2, rh / 2, 0, 0, Math.PI * 2);
        }
        
        // Render modes
        if (shape.mode === 'fill' || shape.mode === 'both') {
            ctx.fillStyle = shape.fillColor;
            ctx.fill();
        }
        if (shape.mode === 'stroke' || shape.mode === 'both') {
            ctx.strokeStyle = shape.strokeColor;
            ctx.lineWidth = strokeW;
            ctx.lineJoin = 'miter';
            ctx.stroke();
        }
    }
    
    // --- PAINT & DRAWING BRUSH ENGINE ---
    drawOnActiveLayer(x1, y1, x2, y2) {
        const active = this.getActiveLayer();
        if (!active) return;
        
        const ctx = active.ctx;
        const brushSize = parseInt(document.getElementById('opt-brush-size').value);
        const opacity = parseInt(document.getElementById('opt-brush-opacity').value) / 100;
        const hardness = parseInt(document.getElementById('opt-brush-hardness').value) / 100;
        
        ctx.save();
        
        if (this.activeTool === 'brush') {
            ctx.globalCompositeOperation = 'source-over';
            
            // Smooth soft/hard brush rendering
            if (hardness < 0.95) {
                // Soft brushes use radial gradients
                const gradient = ctx.createRadialGradient(x2, y2, brushSize * hardness / 2, x2, y2, brushSize / 2);
                const rgb = this.hexToRgb(this.primaryColor);
                
                gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`);
                gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(x2, y2, brushSize / 2, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Hard brush uses simple line drawing
                ctx.strokeStyle = this.primaryColor;
                ctx.globalAlpha = opacity;
                ctx.lineWidth = brushSize;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }
        } else if (this.activeTool === 'eraser') {
            // Eraser uses destination-out composite operation
            const eraserSize = parseInt(document.getElementById('opt-eraser-size').value);
            const eraserOpacity = parseInt(document.getElementById('opt-eraser-opacity').value) / 100;
            
            ctx.globalCompositeOperation = 'destination-out';
            ctx.globalAlpha = eraserOpacity;
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = eraserSize;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
        
        ctx.restore();
        this.render();
    }
    
    // --- EYEDROPPING COLOR SAMPLER ---
    samplePixelColor(canvasX, canvasY) {
        // To sample correct combined canvas colors, render all visible layers to a temp canvas
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.width;
        tempCanvas.height = this.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Draw layers sequentially
        this.layers.forEach(layer => {
            if (layer.visible) {
                tempCtx.save();
                tempCtx.globalAlpha = layer.opacity;
                tempCtx.globalCompositeOperation = layer.blendMode;
                
                // Apply transforms
                tempCtx.translate(layer.x, layer.y);
                const cx = layer.width / 2;
                const cy = layer.height / 2;
                tempCtx.translate(cx, cy);
                tempCtx.rotate(layer.rotation * Math.PI / 180);
                tempCtx.scale(layer.scaleX, layer.scaleY);
                tempCtx.translate(-cx, -cy);
                
                // Draw canvas image
                tempCtx.drawImage(layer.canvas, 0, 0);
                tempCtx.restore();
            }
        });
        
        // Sample coordinate (clamp boundary)
        const x = Math.max(0, Math.min(this.width - 1, canvasX));
        const y = Math.max(0, Math.min(this.height - 1, canvasY));
        const imgData = tempCtx.getImageData(x, y, 1, 1).data;
        
        // If pixel is transparent, default to checkerboard color, otherwise rgb
        if (imgData[3] > 0) {
            const hex = this.rgbToHex(imgData[0], imgData[1], imgData[2]);
            this.primaryColor = hex;
            this.colorWells.primary.style.backgroundColor = hex;
            
            document.getElementById('eyedropper-preview').style.backgroundColor = hex;
            document.getElementById('eyedropper-preview-hex').textContent = hex.toUpperCase();
        }
    }
    
    // --- TRANSFORM HANDLES HIT TESTING ---
    getHitTransformHandle(canvasX, canvasY, layer) {
        const handles = this.getTransformHandlesCoordinates(layer);
        const handleSize = 8 / this.scale; // Increase click target size on low zoom scales
        
        // Check rotation handle first
        const rHandle = handles.rotate;
        if (Math.hypot(canvasX - rHandle.x, canvasY - rHandle.y) <= handleSize * 1.5) {
            return 'rotate';
        }
        
        // Check corner/edge handles
        const keys = ['tl', 't', 'tr', 'r', 'br', 'b', 'bl', 'l'];
        for (let key of keys) {
            const pt = handles[key];
            if (Math.hypot(canvasX - pt.x, canvasY - pt.y) <= handleSize) {
                return `resize-${key}`;
            }
        }
        
        return null;
    }
    
    // Returns 8 bounding box handle coordinates and the 1 rotation handle coordinate in canvas space
    getTransformHandlesCoordinates(layer) {
        const w = layer.width;
        const h = layer.height;
        
        // Coordinates in local space relative to center
        const cx = w / 2;
        const cy = h / 2;
        
        const localPts = {
            tl: { x: 0, y: 0 },
            t: { x: cx, y: 0 },
            tr: { x: w, y: 0 },
            r: { x: w, y: cy },
            br: { x: w, y: h },
            b: { x: cx, y: h },
            bl: { x: 0, y: h },
            l: { x: 0, y: cy }
        };
        
        // Apply transforms
        const mapPt = (pt) => {
            // Relative coordinates
            let rx = (pt.x - cx) * layer.scaleX;
            let ry = (pt.y - cy) * layer.scaleY;
            
            // Rotation
            const rad = layer.rotation * Math.PI / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const tx = rx * cos - ry * sin;
            const ty = rx * sin + ry * cos;
            
            // Translate back to global canvas space
            return {
                x: Math.round(tx + cx + layer.x),
                y: Math.round(ty + cy + layer.y)
            };
        };
        
        const handles = {};
        Object.keys(localPts).forEach(key => {
            handles[key] = mapPt(localPts[key]);
        });
        
        // Rotation Handle (located 28px above top-center)
        const rotLocal = { x: cx, y: -28 / Math.max(0.2, layer.scaleY) };
        handles.rotate = mapPt(rotLocal);
        
        return handles;
    }
    
    // Hit-test polygon: checks if point is inside layer's transformed bounding box
    isPointInsideLayerBoundingBox(canvasX, canvasY, layer) {
        const handles = this.getTransformHandlesCoordinates(layer);
        
        // Form boundary polygon TL -> TR -> BR -> BL
        const polygon = [handles.tl, handles.tr, handles.br, handles.bl];
        
        // Simple ray-casting algorithm to test polygon intersection
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;
            
            const intersect = ((yi > canvasY) !== (yj > canvasY))
                && (canvasX < (xj - xi) * (canvasY - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        
        return inside;
    }
    
    // --- MAIN RENDER LOOP ---
    render() {
        // Clear viewport canvas
        this.viewportCtx.clearRect(0, 0, this.width, this.height);
        
        // Draw layers sequentially from back (0) to front (length-1)
        this.layers.forEach((layer) => {
            if (!layer.visible) return;
            
            this.viewportCtx.save();
            
            // Apply composite values
            this.viewportCtx.globalAlpha = layer.opacity;
            this.viewportCtx.globalCompositeOperation = layer.blendMode;
            
            // Apply transforms: Translate -> Center rotation -> Scale -> Center back
            this.viewportCtx.translate(layer.x, layer.y);
            const cx = layer.width / 2;
            const cy = layer.height / 2;
            
            this.viewportCtx.translate(cx, cy);
            this.viewportCtx.rotate(layer.rotation * Math.PI / 180);
            this.viewportCtx.scale(layer.scaleX, layer.scaleY);
            this.viewportCtx.translate(-cx, -cy);
            
            // Apply adjustments/filters
            this.viewportCtx.filter = layer.getFilterString();
            
            // Render layer canvas
            this.viewportCtx.drawImage(layer.canvas, 0, 0);
            
            this.viewportCtx.restore();
        });
        
        // Re-draw helper overlay UI
        this.renderOverlay();
    }
    
    // Renders bounding boxes, resize handles, and shape creators on the overlay canvas
    renderOverlay() {
        this.overlayCtx.clearRect(0, 0, this.width, this.height);
        
        // Draw active layer highlights when Move/Transform tool is active
        if (this.activeTool === 'move') {
            const active = this.getActiveLayer();
            if (active && active.visible) {
                const h = this.getTransformHandlesCoordinates(active);
                
                this.overlayCtx.save();
                
                // Draw bounding box wireframe
                this.overlayCtx.strokeStyle = '#4f46e5';
                this.overlayCtx.lineWidth = 1.5 / this.scale;
                this.overlayCtx.beginPath();
                this.overlayCtx.moveTo(h.tl.x, h.tl.y);
                this.overlayCtx.lineTo(h.tr.x, h.tr.y);
                this.overlayCtx.lineTo(h.br.x, h.br.y);
                this.overlayCtx.lineTo(h.bl.x, h.bl.y);
                this.overlayCtx.closePath();
                this.overlayCtx.stroke();
                
                // Draw rotation guide line
                this.overlayCtx.beginPath();
                this.overlayCtx.moveTo(h.t.x, h.t.y);
                this.overlayCtx.lineTo(h.rotate.x, h.rotate.y);
                this.overlayCtx.stroke();
                
                // Draw rotation handle circle
                this.overlayCtx.fillStyle = '#facc15';
                this.overlayCtx.strokeStyle = '#ffffff';
                this.overlayCtx.lineWidth = 1.5 / this.scale;
                this.overlayCtx.beginPath();
                this.overlayCtx.arc(h.rotate.x, h.rotate.y, 5 / this.scale, 0, Math.PI * 2);
                this.overlayCtx.fill();
                this.overlayCtx.stroke();
                
                // Draw 8 resizing square handle dots
                this.overlayCtx.fillStyle = '#ffffff';
                this.overlayCtx.strokeStyle = '#4f46e5';
                this.overlayCtx.lineWidth = 1.5 / this.scale;
                
                const handleKeys = ['tl', 't', 'tr', 'r', 'br', 'b', 'bl', 'l'];
                const size = 6 / this.scale;
                
                handleKeys.forEach(key => {
                    const pt = h[key];
                    this.overlayCtx.fillRect(pt.x - size/2, pt.y - size/2, size, size);
                    this.overlayCtx.strokeRect(pt.x - size/2, pt.y - size/2, size, size);
                });
                
                this.overlayCtx.restore();
            }
        }
        
        // Draw temporary shape creation borders
        if (this.activeTool === 'shape' && this.isCreatingShape) {
            this.overlayCtx.save();
            this.overlayCtx.strokeStyle = '#6366f1';
            this.overlayCtx.lineWidth = 2 / this.scale;
            this.overlayCtx.setLineDash([6 / this.scale, 4 / this.scale]);
            
            const shapeType = document.getElementById('opt-shape-type').value;
            const x = Math.min(this.shapeStartX, this.shapeEndX);
            const y = Math.min(this.shapeStartY, this.shapeEndY);
            const w = Math.abs(this.shapeEndX - this.shapeStartX);
            const h = Math.abs(this.shapeEndY - this.shapeStartY);
            
            this.overlayCtx.beginPath();
            if (shapeType === 'rectangle') {
                this.overlayCtx.rect(x, y, w, h);
            } else if (shapeType === 'ellipse') {
                this.overlayCtx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
            }
            this.overlayCtx.stroke();
            this.overlayCtx.restore();
        }
    }
    
    // --- LAYERS DATABASE OPERATIONS ---
    getActiveLayer() {
        if (this.activeLayerIndex >= 0 && this.activeLayerIndex < this.layers.length) {
            return this.layers[this.activeLayerIndex];
        }
        return null;
    }
    
    selectLayer(index) {
        this.activeLayerIndex = index;
        
        // Sync active selection highlight classes in DOM
        const layerItems = document.querySelectorAll('.layer-item');
        layerItems.forEach((item, i) => {
            // Layer list DOM is printed reversed (top layer on top), so map correctly
            const targetIdx = this.layers.length - 1 - i;
            item.classList.toggle('active', targetIdx === index);
        });
        
        const active = this.getActiveLayer();
        if (active) {
            // Update blend mode and opacity controls
            document.getElementById('layer-blend-mode').value = active.blendMode;
            document.getElementById('layer-opacity-input').value = Math.round(active.opacity * 100);
            document.getElementById('layer-opacity-val').textContent = `${Math.round(active.opacity * 100)}%`;
            
            // Sync adjustments sliders values
            this.syncAdjustmentsPanel(active);
            this.syncTransformOptions(active);
            
            // Enable/Disable Layer options based on active
            document.getElementById('btn-layer-up').disabled = (index === this.layers.length - 1);
            document.getElementById('btn-layer-down').disabled = (index === 0);
            
            // Set tool option elements if type matches
            if (active.type === 'text') {
                document.getElementById('opt-text-val').value = active.textData.text;
                document.getElementById('opt-text-size').value = active.textData.fontSize;
                document.getElementById('opt-text-font').value = active.textData.fontFamily;
                document.getElementById('opt-text-bold').classList.toggle('active', active.textData.bold);
                document.getElementById('opt-text-italic').classList.toggle('active', active.textData.italic);
            } else if (active.type === 'shape') {
                document.getElementById('opt-shape-type').value = active.shapeData.type;
                document.getElementById('opt-shape-mode').value = active.shapeData.mode;
                document.getElementById('opt-shape-stroke-width').value = active.shapeData.strokeWidth;
                document.getElementById('opt-shape-stroke-width-val').textContent = `${active.shapeData.strokeWidth}px`;
                document.getElementById('shape-stroke-color').style.backgroundColor = active.shapeData.strokeColor;
            }
        }
        
        this.renderOverlay();
    }
    
    syncAdjustmentsPanel(layer) {
        const adj = layer.adjustments;
        Object.keys(adj).forEach(key => {
            const slider = document.getElementById(`adj-${key}`);
            const display = document.getElementById(`val-${key}`);
            if (slider && display) {
                slider.value = adj[key];
                
                let suffix = '%';
                if (key === 'hue') suffix = '°';
                if (key === 'blur') suffix = 'px';
                display.textContent = `${adj[key]}${suffix}`;
            }
        });
    }
    
    syncTransformOptions(layer) {
        document.getElementById('opt-move-x').value = Math.round(layer.x);
        document.getElementById('opt-move-y').value = Math.round(layer.y);
        document.getElementById('opt-move-w').value = Math.round(layer.width * layer.scaleX);
        document.getElementById('opt-move-h').value = Math.round(layer.height * layer.scaleY);
        document.getElementById('opt-move-rot').value = Math.round(layer.rotation);
        document.getElementById('opt-move-rot-val').textContent = `${Math.round(layer.rotation)}°`;
    }
    
    // --- DOM GENERATOR FOR LAYERS ---
    updateLayersUI() {
        const layersList = document.getElementById('layers-list');
        layersList.innerHTML = '';
        
        // Print layers in reverse order: top layer (last in array) printed at top of list
        for (let i = this.layers.length - 1; i >= 0; i--) {
            const layer = this.layers[i];
            
            const li = document.createElement('li');
            li.className = `layer-item ${i === this.activeLayerIndex ? 'active' : ''} ${!layer.visible ? 'hidden' : ''}`;
            
            // Build Thumbnail preview
            const thumbContainer = document.createElement('div');
            thumbContainer.className = 'layer-thumbnail-container';
            
            // Small badge to indicate layer type
            const badge = document.createElement('div');
            badge.className = 'layer-type-badge';
            badge.textContent = layer.type.charAt(0).toUpperCase();
            
            // Create mini thumbnail canvas
            const thumbCanvas = document.createElement('canvas');
            thumbCanvas.width = 32;
            thumbCanvas.height = 24;
            const thumbCtx = thumbCanvas.getContext('2d');
            thumbCtx.drawImage(layer.canvas, 0, 0, 32, 24);
            
            thumbContainer.appendChild(thumbCanvas);
            thumbContainer.appendChild(badge);
            
            // Eye toggle button (Visibility)
            const eyeBtn = document.createElement('button');
            eyeBtn.className = 'layer-visibility-btn';
            eyeBtn.innerHTML = layer.visible ? 
                `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>` :
                `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9a3 3 0 1 1 4.2 4.2"></path><path d="M17 17a9 9 0 0 1-5 2c-7 0-11-8-11-8a19 19 0 0 1 5-6"></path><path d="M21 12a9 9 0 0 1-5 5"></path></svg>`;
            
            eyeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.saveHistoryState(layer.visible ? 'Hide Layer' : 'Show Layer');
                layer.visible = !layer.visible;
                this.updateLayersUI();
                this.render();
            });
            
            // Double click renaming input
            const nameContainer = document.createElement('div');
            nameContainer.className = 'layer-name-container';
            
            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.className = 'layer-name-input';
            nameInput.value = layer.name;
            nameInput.disabled = true;
            
            nameInput.addEventListener('dblclick', () => {
                nameInput.disabled = false;
                nameInput.focus();
                nameInput.select();
            });
            
            nameInput.addEventListener('blur', () => {
                nameInput.disabled = true;
                if (layer.name !== nameInput.value) {
                    this.saveHistoryState('Rename Layer');
                    layer.name = nameInput.value;
                }
            });
            
            nameInput.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    nameInput.blur();
                }
            });
            
            nameContainer.appendChild(nameInput);
            
            // Assemble list item
            li.appendChild(eyeBtn);
            li.appendChild(thumbContainer);
            li.appendChild(nameContainer);
            
            // Row click selecting
            li.addEventListener('click', () => {
                this.selectLayer(i);
            });
            
            layersList.appendChild(li);
        }
    }
    
    // --- LAYER MANIPULATION CREATION ---
    addNewPaintLayer(name = null) {
        this.saveHistoryState('Add Layer');
        
        this.layerIdCounter++;
        const layerName = name || `Paint Layer ${this.layerIdCounter}`;
        const newLayer = new Layer(this.layerIdCounter, layerName, this.width, this.height, 'paint');
        
        // Add layer on top of stack
        this.layers.push(newLayer);
        this.selectLayer(this.layers.length - 1);
        this.updateLayersUI();
        this.render();
    }
    
    createNewTextLayer(x = 100, y = 100) {
        this.saveHistoryState('Add Text Layer');
        
        this.layerIdCounter++;
        const textLayer = new Layer(this.layerIdCounter, `Text Layer ${this.layerIdCounter}`, this.width, this.height, 'text');
        textLayer.x = Math.round(x);
        textLayer.y = Math.round(y);
        
        // Render initial text layer buffer
        this.updateTextLayerCanvas(textLayer);
        
        this.layers.push(textLayer);
        this.selectLayer(this.layers.length - 1);
        this.updateLayersUI();
        this.render();
        
        // Switch to text options focus
        this.setTool('text');
        document.getElementById('opt-text-val').focus();
        document.getElementById('opt-text-val').select();
    }
    
    createNewShapeLayer(x, y, w, h) {
        this.saveHistoryState('Add Shape Layer');
        
        this.layerIdCounter++;
        const shapeLayer = new Layer(this.layerIdCounter, `Shape Layer ${this.layerIdCounter}`, w + 20, h + 20, 'shape');
        shapeLayer.x = Math.round(x - 10);
        shapeLayer.y = Math.round(y - 10);
        
        // Sync toolbar option properties
        shapeLayer.shapeData.type = document.getElementById('opt-shape-type').value;
        shapeLayer.shapeData.mode = document.getElementById('opt-shape-mode').value;
        shapeLayer.shapeData.strokeWidth = parseInt(document.getElementById('opt-shape-stroke-width').value);
        shapeLayer.shapeData.strokeColor = this.secondaryColor; // Use secondary color as stroke default
        shapeLayer.shapeData.fillColor = this.primaryColor;
        
        this.drawShapeOnLayer(shapeLayer);
        
        this.layers.push(shapeLayer);
        this.selectLayer(this.layers.length - 1);
        this.updateLayersUI();
        this.render();
    }
    
    duplicateActiveLayer() {
        const active = this.getActiveLayer();
        if (!active) return;
        
        this.saveHistoryState('Duplicate Layer');
        
        this.layerIdCounter++;
        const copy = active.clone();
        copy.id = this.layerIdCounter;
        copy.name = `${active.name} copy`;
        
        // Offset duplicate position slightly for user visibility
        copy.x += 20;
        copy.y += 20;
        
        // Insert copy immediately above parent layer
        this.layers.splice(this.activeLayerIndex + 1, 0, copy);
        this.selectLayer(this.activeLayerIndex + 1);
        this.updateLayersUI();
        this.render();
    }
    
    deleteActiveLayer() {
        const active = this.getActiveLayer();
        if (!active) return;
        
        this.saveHistoryState('Delete Layer');
        
        this.layers.splice(this.activeLayerIndex, 1);
        
        // Choose next active layer
        let nextIndex = this.activeLayerIndex - 1;
        if (nextIndex < 0 && this.layers.length > 0) nextIndex = 0;
        
        this.selectLayer(nextIndex);
        this.updateLayersUI();
        this.render();
    }
    
    clearActiveLayer() {
        const active = this.getActiveLayer();
        if (active) {
            this.saveHistoryState('Clear Layer');
            active.ctx.clearRect(0, 0, active.width, active.height);
            this.updateLayersUI();
            this.render();
        }
    }
    
    moveActiveLayer(dir) {
        const idx = this.activeLayerIndex;
        if (idx < 0) return;
        
        if (dir === 'up' && idx < this.layers.length - 1) {
            this.saveHistoryState('Move Layer Up');
            // Swap array positions
            const temp = this.layers[idx];
            this.layers[idx] = this.layers[idx + 1];
            this.layers[idx + 1] = temp;
            
            this.selectLayer(idx + 1);
        } else if (dir === 'down' && idx > 0) {
            this.saveHistoryState('Move Layer Down');
            const temp = this.layers[idx];
            this.layers[idx] = this.layers[idx - 1];
            this.layers[idx - 1] = temp;
            
            this.selectLayer(idx - 1);
        }
        
        this.updateLayersUI();
        this.render();
    }
    
    // --- FILE OPERATIONS: NEW, IMPORT, EXPORT ---
    createNewDocument(w, h, bgOption) {
        this.width = w;
        this.height = h;
        
        // Sync document size displays in CSS
        this.viewportCanvas.width = w;
        this.viewportCanvas.height = h;
        this.overlayCanvas.width = w;
        this.overlayCanvas.height = h;
        
        this.canvasContainer.style.width = `${w}px`;
        this.canvasContainer.style.height = `${h}px`;
        
        document.getElementById('doc-dimensions-display').innerHTML = `${w} &times; ${h} px`;
        
        // Initialize layers list
        this.layers = [];
        this.layerIdCounter = 0;
        
        // Create base background layer
        const bgLayer = new Layer(0, 'Background', w, h, 'paint');
        const ctx = bgLayer.ctx;
        
        if (bgOption === 'white') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
        } else if (bgOption === 'black') {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, w, h);
        } else if (bgOption !== 'transparent') {
            // Hex color code
            ctx.fillStyle = bgOption;
            ctx.fillRect(0, 0, w, h);
        }
        
        this.layers.push(bgLayer);
        
        // Clear history stack
        this.history = [];
        this.historyIndex = -1;
        this.saveHistoryState('Create Canvas');
        
        this.selectLayer(0);
        this.updateLayersUI();
        
        // Reset pan & zoom
        this.zoomToFit();
        this.render();
    }
    
    handleCreateNewDocument() {
        const w = parseInt(document.getElementById('new-doc-width').value) || 1200;
        const h = parseInt(document.getElementById('new-doc-height').value) || 800;
        const bg = document.getElementById('new-doc-bg').value;
        
        this.createNewDocument(w, h, bg);
        this.closeModal('newDoc');
    }
    
    handleFileImport(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                this.saveHistoryState('Import Image');
                
                this.layerIdCounter++;
                const imgLayer = new Layer(this.layerIdCounter, file.name.split('.')[0] || 'Imported Image', img.width, img.height, 'image');
                
                // Draw image on layer canvas
                imgLayer.ctx.drawImage(img, 0, 0);
                
                // Position imported image in middle of canvas
                imgLayer.x = Math.round((this.width - img.width) / 2);
                imgLayer.y = Math.round((this.height - img.height) / 2);
                
                // Auto scale down large images to fit document bounds
                if (img.width > this.width || img.height > this.height) {
                    const aspect = img.width / img.height;
                    const limitScaleW = this.width * 0.8 / img.width;
                    const limitScaleH = this.height * 0.8 / img.height;
                    const fitScale = Math.min(limitScaleW, limitScaleH);
                    
                    imgLayer.scaleX = fitScale;
                    imgLayer.scaleY = fitScale;
                    
                    // Re-calculate centered position with scale applied
                    imgLayer.x = Math.round((this.width - img.width * fitScale) / 2);
                    imgLayer.y = Math.round((this.height - img.height * fitScale) / 2);
                }
                
                this.layers.push(imgLayer);
                this.selectLayer(this.layers.length - 1);
                this.updateLayersUI();
                this.render();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    exportImage(format = 'png') {
        // Create an offscreen temporary canvas to merge all layers
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = this.width;
        exportCanvas.height = this.height;
        const exportCtx = exportCanvas.getContext('2d');
        
        // Draw standard white background for JPEG exports if base layer is transparent
        if (format === 'jpeg') {
            exportCtx.fillStyle = '#ffffff';
            exportCtx.fillRect(0, 0, this.width, this.height);
        }
        
        // Draw layers sequentially
        this.layers.forEach(layer => {
            if (layer.visible) {
                exportCtx.save();
                exportCtx.globalAlpha = layer.opacity;
                exportCtx.globalCompositeOperation = layer.blendMode;
                
                // Apply transformations
                exportCtx.translate(layer.x, layer.y);
                const cx = layer.width / 2;
                const cy = layer.height / 2;
                exportCtx.translate(cx, cy);
                exportCtx.rotate(layer.rotation * Math.PI / 180);
                exportCtx.scale(layer.scaleX, layer.scaleY);
                exportCtx.translate(-cx, -cy);
                
                // Adjustments filter
                exportCtx.filter = layer.getFilterString();
                
                exportCtx.drawImage(layer.canvas, 0, 0);
                exportCtx.restore();
            }
        });
        
        // Trigger file download
        const url = exportCanvas.toDataURL(`image/${format}`, format === 'jpeg' ? 0.95 : undefined);
        const link = document.createElement('a');
        link.download = `Pixora_Export_${Date.now()}.${format}`;
        link.href = url;
        link.click();
    }
    
    // --- SNAPSHOT & UNDO ENGINE ---
    // Takes a deep snapshot copy of the current layers database state
    takeSnapshot() {
        return {
            width: this.width,
            height: this.height,
            activeLayerIndex: this.activeLayerIndex,
            layers: this.layers.map(layer => layer.clone()),
            description: 'Action'
        };
    }
    
    pushHistorySnapshot(snapshot) {
        // Truncate redo history futures if we did new actions
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        this.history.push(snapshot);
        
        // Enforce maximum stack limits
        if (this.history.length > this.maxHistoryStates) {
            this.history.shift();
        }
        
        this.historyIndex = this.history.length - 1;
        this.updateHistoryUI();
    }
    
    saveHistoryState(description = 'Modify Canvas') {
        const snapshot = this.takeSnapshot();
        snapshot.description = description;
        this.pushHistorySnapshot(snapshot);
    }
    
    restoreSnapshot(snapshot) {
        this.width = snapshot.width;
        this.height = snapshot.height;
        
        // Sync elements sizing
        this.viewportCanvas.width = this.width;
        this.viewportCanvas.height = this.height;
        this.overlayCanvas.width = this.width;
        this.overlayCanvas.height = this.height;
        
        this.canvasContainer.style.width = `${this.width}px`;
        this.canvasContainer.style.height = `${this.height}px`;
        document.getElementById('doc-dimensions-display').innerHTML = `${this.width} &times; ${this.height} px`;
        
        // Deep restore layer classes
        this.layers = snapshot.layers.map(l => l.clone());
        this.activeLayerIndex = snapshot.activeLayerIndex;
        
        this.updateLayersUI();
        this.selectLayer(this.activeLayerIndex);
        this.render();
    }
    
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreSnapshot(this.history[this.historyIndex]);
            this.updateHistoryUI();
        }
    }
    
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreSnapshot(this.history[this.historyIndex]);
            this.updateHistoryUI();
        }
    }
    
    updateHistoryUI() {
        const list = document.getElementById('history-list');
        list.innerHTML = '';
        
        this.history.forEach((state, i) => {
            const li = document.createElement('li');
            li.className = 'history-item';
            
            if (i === this.historyIndex) {
                li.classList.add('active');
            } else if (i > this.historyIndex) {
                li.classList.add('future');
            }
            
            li.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 8v4l3 3"></path>
                    <circle cx="12" cy="12" r="9"></circle>
                </svg>
                <span>${state.description}</span>
            `;
            
            li.addEventListener('click', () => {
                this.historyIndex = i;
                this.restoreSnapshot(this.history[this.historyIndex]);
                this.updateHistoryUI();
            });
            
            list.appendChild(li);
        });
        
        // Auto scroll to bottom
        list.parentElement.scrollTop = list.parentElement.scrollHeight;
    }
    
    // --- HELPER MATH UTILITIES ---
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 59, g: 130, b: 246 }; // fallback blue
    }
    
    rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }
}

// --- INITIALIZE APPLICATION ON LOAD ---
window.addEventListener('DOMContentLoaded', () => {
    window.pixora = new PixoraApp();
});
