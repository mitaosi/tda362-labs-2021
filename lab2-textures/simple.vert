#version 420

layout(location = 0) in vec3 position;
layout(location = 1) in vec3 colour;
layout(location = 2) in vec2 texture;

uniform mat4 projectionMatrix;
uniform vec3 cameraPosition;

out vec3 outColour;
out vec2 outTexture;

// >>> @task 3.2

void main()
{
	vec4 pos = vec4(position.xyz - cameraPosition.xyz, 1);
	gl_Position = projectionMatrix * pos;

	outColour = colour;
	outTexture = texture;

	// >>> @task 3.3
}