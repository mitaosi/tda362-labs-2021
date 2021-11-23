#version 420

// required by GLSL spec Sect 4.5.3 (though nvidia does not, amd does)
precision highp float;


// >>> @task 3.4

layout(location = 0) out vec4 fragmentColor;
layout(binding = 0) uniform sampler2D colourtexture;

in vec3 outColour;
in vec2 outTexture;

void main()
{
	// >>> @task 3.5
	fragmentColor = texture2D(colourtexture, outTexture.xy);
}