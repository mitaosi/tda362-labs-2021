#version 420

// required by GLSL spec Sect 4.5.3 (though nvidia does not, amd does)
precision highp float;

///////////////////////////////////////////////////////////////////////////////
// Material
///////////////////////////////////////////////////////////////////////////////
uniform vec3 material_color;
uniform float material_reflectivity;
uniform float material_metalness;
uniform float material_fresnel;
uniform float material_shininess;
uniform float material_emission;

uniform int has_color_texture;
layout(binding = 0) uniform sampler2D colorMap;
uniform int has_emission_texture;
layout(binding = 5) uniform sampler2D emissiveMap;

///////////////////////////////////////////////////////////////////////////////
// Environment
///////////////////////////////////////////////////////////////////////////////
layout(binding = 6) uniform sampler2D environmentMap;
layout(binding = 7) uniform sampler2D irradianceMap;
layout(binding = 8) uniform sampler2D reflectionMap;
uniform float environment_multiplier;

///////////////////////////////////////////////////////////////////////////////
// Light source
///////////////////////////////////////////////////////////////////////////////
uniform vec3 point_light_color = vec3(1.0, 1.0, 1.0);
uniform float point_light_intensity_multiplier = 50.0;

///////////////////////////////////////////////////////////////////////////////
// Constants
///////////////////////////////////////////////////////////////////////////////
#define PI 3.14159265359

///////////////////////////////////////////////////////////////////////////////
// Input varyings from vertex shader
///////////////////////////////////////////////////////////////////////////////
in vec2 texCoord;
in vec3 viewSpaceNormal;
in vec3 viewSpacePosition;

///////////////////////////////////////////////////////////////////////////////
// Input uniform variables
///////////////////////////////////////////////////////////////////////////////
uniform mat4 viewInverse;
uniform vec3 viewSpaceLightPosition;

///////////////////////////////////////////////////////////////////////////////
// Output color
///////////////////////////////////////////////////////////////////////////////
layout(location = 0) out vec4 fragmentColor;


vec3 calculateDirectIllumiunation(vec3 wo, vec3 n)
{
	
	///////////////////////////////////////////////////////////////////////////
	// Task 1.2 - Calculate the radiance Li from the light, and the direction
	//            to the light. If the light is backfacing the triangle,
	//            return vec3(0);
	///////////////////////////////////////////////////////////////////////////

	// distance from fragment to light source
	float d = length(viewSpaceLightPosition - viewSpacePosition);
	// Incoming radiance
	vec3 Li = point_light_intensity_multiplier * point_light_color * (1.0/(d*d));
	vec3 Wi = normalize(viewSpaceLightPosition - viewSpacePosition);
	float ndotwo = max(0.0, dot(n, wo));
	float ndotwi = max(0.0, dot(n, Wi));
	float denom = (4.0*ndotwo*ndotwi);
	//If n.wi <=0, then the light is incoming from the other side of the triangle,
	//so this side will not be lit at all,so just return black.
	if(denom <= 0.0) { return vec3(0.0); }
	
	///////////////////////////////////////////////////////////////////////////
	// Task 1.3 - Calculate the diffuse term and return that as the result
	///////////////////////////////////////////////////////////////////////////
	vec3 diffuse_term = material_color * (1.0/PI) * abs(ndotwi) * Li; 

	///////////////////////////////////////////////////////////////////////////
	// Task 2 - Calculate the Torrance Sparrow BRDF and return the light
	//          reflected from that instead
	///////////////////////////////////////////////////////////////////////////
	
	vec3 Wh = normalize(Wi + wo);	
	float wodotwh = max(0.0, dot(wo, Wh));
	float ndotwh = max(0.0, dot(n, Wh));
	float whdotwi = max(0.0, dot(Wh, Wi));

	// Fuck fresnel term
	float R0 = material_fresnel;
	float F = R0 + (1.0 - R0)*pow((1.0 - wodotwh),5.0);

	// Microfacet distribution
	float s = material_shininess;
	float D = ((s+2.0)/(2.0*PI))*pow(ndotwh,s);
	float A = 2.0*ndotwh*ndotwo/wodotwh;
	float B = 2.0*ndotwh*ndotwi/wodotwh;

	// Shadowing/Masking function
	float G = min(1.0,min(A,B));

	// brdf
	float brdf = F*D*G/denom;	

	///////////////////////////////////////////////////////////////////////////
	// Task 3 - Make your shader respect the parameters of our material model.
	///////////////////////////////////////////////////////////////////////////
	
	vec3 dielectric_term = brdf * ndotwi * Li + (1-F) * diffuse_term;
	vec3 metal_term = brdf * material_color * ndotwi * Li;

	// Microfacet term
	float m = material_metalness;
	vec3 micro_facet_term = m * metal_term + (1 - m) * dielectric_term;

	float r = material_reflectivity;
	//return diffuse_term;
	//return brdf * ndotwi * Li;
	return r * micro_facet_term + (1 - r) * diffuse_term;

}

vec3 calculateIndirectIllumination(vec3 wo, vec3 n)
{
	///////////////////////////////////////////////////////////////////////////
	// Task 5 - Lookup the irradiance from the irradiance map and calculate
	//          the diffuse reflection
	///////////////////////////////////////////////////////////////////////////
	// World space normal
	vec3 nws = vec3 (viewInverse * vec4(n,0.0f));

	//vec3 dir = normalize(pixel_world_pos.xyz - camera_pos);
	vec3 dir = nws;

	//Calculate the spherical coordinates of the direction
	float theta = acos(max(-1.0f, min(1.0f, dir.y)));
	float phi = atan(dir.z, dir.x);
	if(phi < 0.0f)
	{
		phi = phi + 2.0f * PI;
	}

	// Use these to lookup the color in the environment map
	vec2 lookup = vec2(phi / (2.0 * PI), theta / PI);

	vec4 irradiance = environment_multiplier * texture(irradianceMap, lookup);
	vec4 diffuse_term = vec4 (material_color,1) * (1.0 / PI) * irradiance;
	
	///////////////////////////////////////////////////////////////////////////
	// Task 6 - Look up in the reflection map from the perfect specular
	//          direction and calculate the dielectric and metal terms.
	///////////////////////////////////////////////////////////////////////////
	// The spherical coordinates
	vec3 wi = normalize(- reflect(wo,n));
	dir = normalize (vec3(viewInverse * vec4 (wi,0.0f)));

	theta = acos(max(-1.0f, min(1.0f, dir.y)));
	phi = atan(dir.z, dir.x);
	if(phi < 0.0f)
	{
		phi = phi + 2.0f * PI;
	}

	// Use these to lookup the color in the environment map
	lookup = vec2(phi / (2.0 * PI), theta / PI);

	float s = material_shininess;
	float roughness = sqrt(sqrt(2/(s+2)));
	vec3 Li = environment_multiplier * textureLod(reflectionMap,lookup,roughness * 7.0).xyz; 

	vec3 wh = normalize(wi + wo);
	float whdotwi = max(0.0,dot(wh,wi));

	// The fresnel term
	float R0 = material_fresnel;
	float F = R0 + (1.0 - R0)*pow((1.0 - whdotwi),5.0);
	
	vec3 dielectric_term = F * Li * (1 - F) * vec3(diffuse_term);
	vec3 metal_term = F * material_color * Li;

	// Microfacet term
	float m = material_metalness;
	vec3 micro_facet_term = m * metal_term + (1 - m) * dielectric_term;
	float r = material_reflectivity;
	return r * micro_facet_term + (1 - r) * vec3(diffuse_term);	
}



void main()
{
	vec3 wo = -normalize(viewSpacePosition);
	vec3 n = normalize(viewSpaceNormal);

	vec3 base_color = material_color;
	if(has_color_texture == 1)
	{
		base_color *= texture(colorMap, texCoord).xyz;
	}

	// Direct illumination
	vec3 direct_illumination_term = calculateDirectIllumiunation(wo, n);

	// Indirect illumination
	vec3 indirect_illumination_term = calculateIndirectIllumination(wo, n);

	///////////////////////////////////////////////////////////////////////////
	// Add emissive term. If emissive texture exists, sample this term.
	///////////////////////////////////////////////////////////////////////////
	vec3 emission_term = material_emission * material_color;
	if(has_emission_texture == 1)
	{
		emission_term *= texture(emissiveMap, texCoord).xyz;
	}

	fragmentColor.xyz = direct_illumination_term + indirect_illumination_term + emission_term;
}
