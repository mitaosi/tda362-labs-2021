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


vec3 calculateDirectIllumiunation(vec3 wo, vec3 n, vec3 base_color)
{
	vec3 direct_illum = base_color;
	///////////////////////////////////////////////////////////////////////////
	// Task 1.2 - Calculate the radiance Li from the light, and the direction
	//            to the light. If the light is backfacing the triangle,
	//            return vec3(0);
	///////////////////////////////////////////////////////////////////////////
	//d= distance from fragment to light source
	float d = length(viewSpaceLightPosition - viewSpacePosition);
	vec3 Li = point_light_color * point_light_intensity_multiplier / (d * d);
	vec3 wi = normalize(viewSpaceLightPosition - viewSpacePosition);

	float ndotwo = max(0.0, dot(n, wo));
	float ndotwi = max(0.0, dot(n, wi));
	float denom = (4.0*ndotwo*ndotwi);

	//If n.wi <=0, then the light is incoming from the other side of the triangle,
	//so this side will not be lit at all,so just return black.
	if(denom <= 0.0) { 
		return vec3(0.0); 
	}
	///////////////////////////////////////////////////////////////////////////
	// Task 1.3 - Calculate the diffuse term and return that as the result
	///////////////////////////////////////////////////////////////////////////
	vec3 diffuse_term = material_color * (1.0f/PI) * length(dot(n,wi)) * Li;

	///////////////////////////////////////////////////////////////////////////
	// Task 2 - Calculate the Torrance Sparrow BRDF and return the light
	//          reflected from that instead
	///////////////////////////////////////////////////////////////////////////
	vec3 wh = normalize(wi+wo);

	float wodotwh = max(0.0, dot(wo, wh));
	float ndotwh = max(0.0, dot(n, wh));
	float whdotwi = max(0.0, dot(wh, wi));

	// Fuck fresnel term
	float R0 = material_fresnel;
	float F = R0 + (1.0 - R0)*pow((1.0 - wodotwh),5.0);

	// Microfacet distribution
	float D = ((material_shininess+2.0)/(2.0*PI))*pow(ndotwh,material_shininess);
	float A = 2.0*ndotwh*ndotwo/wodotwh;
	float B = 2.0*ndotwh*ndotwi/wodotwh;
	// Shadowing/Masking function
	float G = min(1.0,min(A,B));

	float brdf = F*D*G/denom;
	
	///////////////////////////////////////////////////////////////////////////
	// Task 3 - Make your shader respect the parameters of our material model.
	///////////////////////////////////////////////////////////////////////////
	vec3 dielectric_term = brdf * ndotwi * Li + (1-F) * diffuse_term;
	vec3 metal_term = brdf * material_color * ndotwi * Li;
	vec3 micro_facet_term = material_shininess * metal_term + (1 - material_metalness) * dielectric_term;

	float r = material_reflectivity;
	//return direct_illum;
	//return brdf * dot(n, wi) * Li; 
	return r * micro_facet_term + (1 - r) * diffuse_term;
}

vec3 calculateIndirectIllumination(vec3 wo, vec3 n, vec3 base_color)
{
	vec3 indirect_illum = vec3(0.f);
	///////////////////////////////////////////////////////////////////////////
	// Task 5 - Lookup the irradiance from the irradiance map and calculate
	//          the diffuse reflection
	///////////////////////////////////////////////////////////////////////////

	///////////////////////////////////////////////////////////////////////////
	// Task 6 - Look up in the reflection map from the perfect specular
	//          direction and calculate the dielectric and metal terms.
	///////////////////////////////////////////////////////////////////////////

	return indirect_illum;
}


void main()
{
	///////////////////////////////////////////////////////////////////////////
	// Task 1.1 - Fill in the outgoing direction, wo, and the normal, n. Both
	//            shall be normalized vectors in view-space.
	///////////////////////////////////////////////////////////////////////////
	// vec3 wo = vec3(1.0);
	// vec3 n = vec3(1.0);
	vec3 n = normalize(viewSpaceNormal);
    vec3 wo = normalize(-viewSpacePosition);

	vec3 base_color = material_color;
	if(has_color_texture == 1)
	{
		base_color *= texture(colorMap, texCoord).xyz;
	}

	vec3 direct_illumination_term = vec3(0.0);
	{ // Direct illumination
		direct_illumination_term = calculateDirectIllumiunation(wo, n, base_color);
	}

	vec3 indirect_illumination_term = vec3(0.0);
	{ // Indirect illumination
		indirect_illumination_term = calculateIndirectIllumination(wo, n, base_color);
	}

	///////////////////////////////////////////////////////////////////////////
	// Task 1.4 - Make glowy things glow!
	///////////////////////////////////////////////////////////////////////////
	//vec3 emission_term = vec3(0.0);
	vec3 emission_term = material_emission * material_color;
	
	vec3 final_color = direct_illumination_term + indirect_illumination_term + emission_term;

	// Check if we got invalid results in the operations
	if(any(isnan(final_color)))
	{
		final_color.xyz = vec3(1.f, 0.f, 1.f);
	}

	fragmentColor.xyz = final_color;
}
