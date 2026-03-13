import * as Cesium from 'cesium';

let activeStage = null;

export function setupShaders(viewer) {
    const stages = viewer.scene.postProcessStages;

    // FLIR (Thermal) Shader
    const flirShader = `
    uniform sampler2D colorTexture;
    in vec2 v_textureCoordinates;
    void main() {
      vec4 color = texture(colorTexture, v_textureCoordinates);
      float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      // Map brightness to a false-color heat palette (black -> blue -> red -> yellow -> white)
      vec3 heat;
      if (lum < 0.25) heat = mix(vec3(0.0), vec3(0.0, 0.0, 1.0), lum * 4.0);
      else if (lum < 0.5) heat = mix(vec3(0.0, 0.0, 1.0), vec3(1.0, 0.0, 0.0), (lum - 0.25) * 4.0);
      else if (lum < 0.75) heat = mix(vec3(1.0, 0.0, 0.0), vec3(1.0, 1.0, 0.0), (lum - 0.5) * 4.0);
      else heat = mix(vec3(1.0, 1.0, 0.0), vec3(1.0), (lum - 0.75) * 4.0);
      
      out_FragColor = vec4(heat, 1.0);
    }
  `;

    // Night Vision Shader
    const nvShader = `
    uniform sampler2D colorTexture;
    in vec2 v_textureCoordinates;
    float rand(vec2 co){ return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453); }
    void main() {
      vec4 color = texture(colorTexture, v_textureCoordinates);
      float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      vec3 nvColor = vec3(0.1, 0.95, 0.2) * lum * 1.5;
      
      // Add noise
      float noise = rand(v_textureCoordinates * czm_frameNumber) * 0.1;
      nvColor += noise;
      
      // Vignette
      float dist = distance(v_textureCoordinates, vec2(0.5));
      nvColor *= smoothstep(0.8, 0.3, dist);
      
      out_FragColor = vec4(nvColor, 1.0);
    }
  `;

    // CRT Scanline / Aberration Shader
    const crtShader = `
    uniform sampler2D colorTexture;
    in vec2 v_textureCoordinates;
    void main() {
      vec2 uv = v_textureCoordinates;
      
      // Chromatic aberration
      float r = texture(colorTexture, vec2(uv.x + 0.002, uv.y)).r;
      float g = texture(colorTexture, uv).g;
      float b = texture(colorTexture, vec2(uv.x - 0.002, uv.y)).b;
      vec3 color = vec3(r, g, b);
      
      // Scanlines
      float scanline = sin(uv.y * 800.0) * 0.04;
      color -= scanline;
      
      // Flicker
      if (mod(czm_frameNumber, 10.0) < 1.0) color *= 0.95;
      
      out_FragColor = vec4(color, 1.0);
    }
  `;

    const flirStage = stages.add(new Cesium.PostProcessStage({ fragmentShader: flirShader }));
    const nvStage = stages.add(new Cesium.PostProcessStage({ fragmentShader: nvShader }));
    const crtStage = stages.add(new Cesium.PostProcessStage({ fragmentShader: crtShader }));

    flirStage.enabled = false;
    nvStage.enabled = false;
    crtStage.enabled = false;

    const modeButtons = document.querySelectorAll('.filter-btn');
    modeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const mode = e.target.dataset.mode;

            flirStage.enabled = false;
            nvStage.enabled = false;
            crtStage.enabled = false;

            if (mode === 'flir') flirStage.enabled = true;
            else if (mode === 'nvg') nvStage.enabled = true;
            else if (mode === 'crt') crtStage.enabled = true;
        });
    });
}
