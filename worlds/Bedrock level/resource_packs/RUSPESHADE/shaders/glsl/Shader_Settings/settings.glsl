/*
RUSPE Shader Settings (Inspired from ESTN Shaders)
Change stuff without much coding knowledge
If you have questions either comment on mcpedl
Or ask on Twitter @TDAP13
*/


//	true to turn on features
//	false to turn off features

const bool water = true;                     //The water color thingy
const bool water_reflection = false;  //water sun reflection
const bool water_waves =  true;      //water surface waves(note: if you turn this off, water and water_reflection will turn off
const bool under_water = true;        // under water effect
const bool uw_waves = true;           //under water waves
const bool plant_waves = true;       //plant waves
const bool sun_reflection = false;   //sun reflection/specular
const bool player_shadow =  true;//player shadow
const bool block_shadow = true;  //block shadow


//	how to change
//	the values indicates how intense each color channel is
//	for something orange,
//	change values to (1.0, 0.5, -0.5)
//	ignore    red     green    blue
//	   ⬇         ⬇         ⬇         ⬇
//	vec3(     0.0,       0.0,       0.0    );


const vec3 light_color = vec3(0.0, 0.0, 0.0);
const vec3 nether_light_color = vec3(1.0, 0.15, -0.5);