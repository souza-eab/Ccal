// --- --- --- --- OBJETIVO: CONSTRUIR MODELO PARA O CCAL
// QCN (Biomassa) + MapBiomas (Uso e cobertura + Desmatamento e Vegetação Secundaria)

// Conferir: 106, 111, 200
// --- --- --- ASSETS
 
// --- --- TABELAS
// --- Tabela de incremento de regeneração, QCN
var incrementos = ee.FeatureCollection('users/barbarazimbres/incremento_metodo_SPATIAL') 
  .map(function(feature){
    return feature.set({
      // regras para florestas secundarias //
      315:feature.get('AP_FSEC'), //  Pastagem                    |>    Floresta secundária
      319:feature.get('AC-FSEC'), //  Lavoras Temporaria          |>    Floresta secundária
      339:feature.get('AC-FSEC'), //  Soja                        |>    Floresta secundária
      320:feature.get('AC-FSEC'), //  Cana de Açucar              |>    Floresta secundária
      340:feature.get('AC-FSEC'), //  Arroz                       |>    Floresta secundária
      362:feature.get('AC-FSEC'), //  Algodão                     |>    Floresta secundária
      341:feature.get('AC-FSEC'), //  Outras Lavouras temporárias |>    Floresta secundária
      336:feature.get('AC-FSEC'), //  Lavouras Perenes            |>    Floresta secundária
      346:feature.get('AC-FSEC'), //  Café                        |>    Floresta secundária
      347:feature.get('AC-FSEC'), //  Citrus                      |>    Floresta secundária
      335:feature.get('AC-FSEC'), //  Dende                       |>    Floresta secundária
      348:feature.get('AC-FSEC'), //  Outras Lavouras Perenes     |>    Floresta secundária
      321:feature.get('O-FSEC'),  //  Mosaicos de Usos            |>    Floresta secundária
      309:feature.get('F-FSEC'),  //  Silvicultura                |>    Floresta secundária
      // 323:feature.get('O-FSEC'), ?? // praia, duna e areal
      // 325:feature.get('O-FSEC'), // outras areas não vegetadas

      324:feature.get('O-FSEC'), // área urbana
      330:feature.get('O-FSEC'), // mineração
    });
  });
print('incrementos',incrementos);

//- Periodic annual increment
// tabela de incremento por bioma
// AP_FSEC -> pastagem para floresta secundária, 
// AC-FSEC -> agricultura para floresta secundária, 
// O-FSEC  -> outros para floresta secundária
// F-FSEC -> floresta plantada para floresta secundária, 

// AP - > 15
// AC -> 19,39,20,40,62,41,35,36,46,47,48
// O  -> 21
// F - > 9

// 1100; 1200; 1300;
// 11;  12; 13; 20;  21; 3; 36;  39; 4; 40;  41; 46;  47; 48;  49; 5; 50;  62; 9

// --- --- IMAGENS
// --- Carbono total no tempo preterito, {QCN/MCTI}
var qcn = ee.ImageCollection('projects/mapbiomas-workspace/SEEG/2022/QCN/QCN_30m_BR_v2_0_1').mosaic();
//Map.addLayer(qcn,{},'qcn');
var carbon_total = qcn.select('total'); // QCN_total = AGB+ BGB + DW + LI 

/*
Asset Legend 
--- Desmatamento e vegetação secundaria, MapBiomas (col. 7.1)
 -- mapa de correlação do valor dos pixeis com a classe observado
    1:'Antrópico',
    2:'Veg. Primária',
    3:'Veg. Secundária',
    4:'Supressão Veg. Primária',
    5:'Recrescimento de Veg. Secundária',
    6:'Supressão Veg. Secundária',
    7:'Outras transições',
*/
// SecVeg_Mapbiomas Collection 8
var desf_reg_raw = ee.Image('projects/mapbiomas-workspace/public/collection8/mapbiomas_collection80_deforestation_secondary_vegetation_v1');
var desf_reg = desf_reg_raw.divide(100).int(); 
var lulc = desf_reg_raw.mod(100).int(); 
lulc = lulc.addBands(lulc.select('classification_2022').rename('classification_2023')); // final years are the same (2022-2023)

var years = [
  1986,1987,1988,1989,
  1990,1991,1992,1993,1994,
  1995,1996,1997,1998,
  1999,2000,2001,2002,2003,2004,
  2005,2006,2007,2008,2009,
  2010,2011,2012,2013,2014,
  2015,2016,2017,2018,2019,
  2020,2021,2022
];
// Map.addLayer(lulc_for,{},'lulc_for');

var increment_old_values = [
  // 11, 12, 13, 20, 21,  3, 36, 39,  4, 40, 41, 46, 47, 48,49,  5, 50, 62,  9;
    11, 12, 13,  /*3,*/  4, 49,  5, 50,  
    315, 
    319, 
    339, 320, 340, 362, 341, 
    336, 
    346, 347, 335, 348, 321, 309, 324, 330
];

// New values
var increment_new_values = increment_old_values.map(function(e){
  var special = [11,12,13]; 
  e = special.indexOf(e) !== -1 ? ''+e+'00' : ''+e;
  return incrementos.first().getNumber(e);
});

var carbon_total_regrowth = ee.Image().rename('classification_1985')
  .addBands(ee.Image().rename('classification_2023'));
print('carbon_total_regrowth:1985_2023',carbon_total_regrowth);

// Function
years.forEach(function(year, i){

  var forest_flat = lulc // ,         
    .where(lulc.eq(5),3) // Mangue 5
    .where(lulc.eq(6),3) // floresta alagavel 6
    .eq(3)               // floresta 3          
    .slice(0,i+2)
    .reduce('max')
    .selfMask();

  var lulc_year = lulc.select(i+1);
  
  lulc_year = lulc_year.where(lulc_year.eq([3,5,6]).reduce('max').selfMask(),3); // idem eq (6)
  
  var lulc_for_year = lulc_year
    .add(forest_flat);
  
  var desf_reg_year = desf_reg.select(i)
    .remap([3,5],[1,1]) // vegetação secundaria 3, recrescimento 5
    .selfMask(); 

  // print('desf_reg_year',desf_reg_year);

  var regrowth_year = lulc_year
    .where(lulc_for_year.gt(0),lulc_for_year)
    .remap(increment_old_values,increment_new_values)
    .updateMask(desf_reg_year);

  // print('regrowth_year',regrowth_year);

  var regrowth_prev_year = carbon_total_regrowth.select('classification_'+(year-1));
  
  regrowth_year = regrowth_year
    .where(regrowth_prev_year.gt(0),regrowth_year.add(regrowth_prev_year))
    .rename('classification_'+year);
  
  carbon_total_regrowth = carbon_total_regrowth
    .addBands(regrowth_year);
  
});

print('carbon_total_regrowth',carbon_total_regrowth);

/*
Accessing Mapbiomas to check for occurrences of water class areas
*/
// - Asset: Mapbiomas Collection 8
var lulc_original = ee.Image('projects/mapbiomas-workspace/public/collection8/mapbiomas_collection80_integration_v1');    // C8
// var lulc_original = ee.Image('projects/mapbiomas-workspace/public/collection7_1/mapbiomas_collection71_integration_v1');  // C7_1

var ocorrencia_areas_submersas = lulc_original.eq(33) 
  .selfMask()
  .blend(lulc_original.eq(31).selfMask())
  .reduce('sum');

var sempre_submersas = ocorrencia_areas_submersas.gte(36).selfMask();

carbon_total_regrowth = carbon_total_regrowth.slice(2);
//print(carbon_total_regrowth, 'carbon_total_regrowth_2')


/* 

// TETO PARA O INCREMENTO
var regrowth_limit = carbon_total.multiply(0.44); 


Map.addLayer(carbon_total,{},'carbon_total');
Map.addLayer(regrowth_limit,{},'regrowth_limite');
Map.addLayer(carbon_total_regrowth,{},'carbon_total_regrowth');

var carbon_total_regrowth_limit = carbon_total_regrowth.subtract(regrowth_limit);

Map.addLayer(carbon_total_regrowth_limit,{},'carbon_total_regrowth_limit');
Map.addLayer(carbon_total_regrowth_limit.gt(0).selfMask(),{},'carbon_total_regrowth_limit');

carbon_total_regrowth = carbon_total_regrowth
  .where(carbon_total_regrowth_limit.gt(0).selfMask(),regrowth_limit);

Map.addLayer(carbon_total_regrowth,{},'carbon_total_regrowth');

*/

//print('desf_reg',desf_reg,'carbon_total_regrowth',carbon_total_regrowth,'carbon_total',carbon_total);


/*
Where 
*/


/*
Asset Legend 
--- Desmatamento e vegetação secundaria, MapBiomas (col. 7.1)
 -- mapa de correlação do valor dos pixeis com a classe observado
    1:'Antrópico',
    2:'Veg. Primária',
    3:'Veg. Secundária',
    4:'Supressão Veg. Primária',
    5:'Recrescimento de Veg. Secundária',
    6:'Supressão Veg. Secundária',
    7:'Outras transições',
*/
Map.addLayer(desf_reg,[],'// SecVeg_Mapbiomas Collection 8');
  var model = desf_reg.multiply(0)                // imagem em branco
  .where(desf_reg.eq(1),0)                          // 1: Antropico = 0
  .where(desf_reg.eq(2),carbon_total)               // 2:'Veg. Primária' = QCN_Total
  .where(desf_reg.eq(3),carbon_total_regrowth)      // 3:'Veg. Secundária'= QCN_Total & Incremento
  .where(desf_reg.eq(4),0)                          // 4:'Supressão Veg. Primária' = 0 
  .where(desf_reg.eq(5),carbon_total_regrowth)      // 5:'Recrescimento de Veg. Secundária'  = QCN_Total & Incremento
  .where(desf_reg.eq(6),0)                          // 6:'Supressão Veg. Secundária' = 0
  .where(desf_reg.eq(7),carbon_total)               // 7:'Outras transições' = QCN_Total
  .where(sempre_submersas,0)                        // Water = 0 
  //.subtract(degradacao_primaria);
  


// --- ---- PLOT  
Map.addLayer(model,{bands:'classification_2022'},'model 2022');
Map.addLayer(desf_reg,{},'desf_reg');
Map.addLayer(lulc,{},'lulc');


Map.addLayer(desf_reg.eq(5).reduce('sum'),{min:0,max:4},'recorrecia de recrecimento');
// stop;

var lulc_param = {
  min:0,
  max:62,
  palette:require('users/mapbiomas/modules:Palettes.js').get('classification8'),
  bands:['classification_1986']
};

Map.addLayer(lulc,lulc_param,'lulc original');

Map.addLayer(ocorrencia_areas_submersas,{min:0,max:10},'ocorrencia_areas_submersas');
Map.addLayer(sempre_submersas,{palette:'000080'},'sempre_submersas');

// --- ---- EXPORT


var Mapp = require('users/joaovsiqueira1/packages:Mapp.js');
Map.setOptions({ 'styles': { 'Dark': Mapp.getStyle('Dark'), 'Dark2':Mapp.getStyle('Dark2'), 'Aubergine':Mapp.getStyle('Aubergine'), 'Silver':Mapp.getStyle('Silver'), 'Night':Mapp.getStyle('Night'), } });
// The most recent zoom is the one the view will have.

var bounds = lulc_original.geometry().bounds();

var oldbands = model.bandNames().slice(0,-1);
print(oldbands);
var newbands = oldbands.iterate(function(current,previous){
  var newname = ee.String(current).replace('classification','biomass_stock');
  return ee.List(previous).add(newname);
},[]);

model = model.select(oldbands,newbands)
  .float()
  .set({
    description:'https://code.earthengine.google.com/?noload=1&scriptPath=users%2Fwallacesilva%2Fseeg%3ACCAL%2FBIOMASS_STOCK%2FMODEL%2Fv020-QCN_MapBiomas8-biomassa_total-1986_2022'
  });
print('model',model);

var description = 'biomassa_total-QCN_MapBiomas8-1986_2022-v021';
var assetId = 'projects/mapbiomas-workspace/CCAL/';

Export.image.toAsset({
  image:model,
  description:'W-SEEG_CCAL-'+description,
  assetId:assetId + description,
  pyramidingPolicy:'median',
  // dimensions:,
  region:bounds,
  scale:30,
  // crs:,
  // crsTransform:,
  maxPixels:1e13,
  // shardSize:
});


// --- Balanço de Carbono, organizando asset para a plataforma do CCAL

var biomas = ee.FeatureCollection('projects/mapbiomas-workspace/AUXILIAR/biomas_IBGE_250mil');
/// - 'Carbon stock' in native vegetation of Brazil - Our asset is the official map of the Fourth National Communication, MCTI, 2020;
// var carbon_total_preterito = ee.ImageCollection('projects/mapbiomas-workspace/SEEG/2022/QCN/QCN_30m_BR_v2_0_1').mosaic().select('total');
var carbon_total_preterito = carbon_total;
print('carbon_total_preterito',carbon_total_preterito);

Map.addLayer(desf_reg,{bands:['classification_2016'],min:0,max:7},'desf_secVeg');
Map.addLayer(lulc,{bands:['classification_2016'],min:0,max:62},'lulc desf_secVeg');


// var carbon_total_anual = ee.Image('projects/mapbiomas-workspace/SEEG/2023/CCAL/biomass_stock-v5-1986_2022-raster_stack');
var carbon_total_anual = model;
print('carbon_total_anual',carbon_total_anual);
// Ano atual - Ano anterior, no primeiro ano é considerado o carbono preterito como anteiror
var gain_loss = carbon_total_anual
  .subtract(carbon_total_preterito.addBands(carbon_total_anual.slice(0,-1)));

// listas com nomes antidos e novos;
var stock_bands = gain_loss.bandNames();
var gain_bands = stock_bands.iterate(function(curr, prev){ return ee.List(prev).add(ee.String(curr).replace('biomass_stock','gain'))},[]);
var secVeg_bands = stock_bands.iterate(function(curr, prev){ return ee.List(prev).add(ee.String(curr).replace('biomass_stock','loss_secVeg'))},[]);
var natVeg_bands = stock_bands.iterate(function(curr, prev){ return ee.List(prev).add(ee.String(curr).replace('biomass_stock','loss_natVeg'))},[]);

// print('stock_bands',stock_bands);
// print('gain_bands',gain_bands);
// print('loss_bands',loss_bands);

var gain = gain_loss.updateMask(gain_loss.gt(0)).select(stock_bands,gain_bands);
var loss = gain_loss.updateMask(gain_loss.lt(0)).select(stock_bands);
var loss_pri = loss.updateMask(desf_reg.slice(0,-1).eq(4)).select(stock_bands,natVeg_bands);
var loss_sec = loss.updateMask(desf_reg.slice(0,-1).eq(6)).select(stock_bands,secVeg_bands);
loss_sec = loss.updateMask(desf_reg.slice(0,-1).eq(1)).select(stock_bands,secVeg_bands).blend(loss_sec);
var stable = gain_loss.updateMask(gain_loss.eq(0));

var finalImageCCAL = gain
  //.addBands(loss)
  .addBands(loss_pri)
  .addBands(loss_sec)
  .addBands(carbon_total_anual.slice(-1).rename('stock'))
  .float()
  .set({
    description:'https://code.earthengine.google.com/?noload=1&scriptPath=users%2Fwallacesilva%2Fseeg%3ACCAL%2FBIOMASS_STOCK%2FMODEL%2Fv020-QCN_MapBiomas8-biomassa_total-1986_2022'
  });

print('gain_loss',gain_loss);
print('gain',gain);
print('loss',loss);
print('loss_pri',loss_pri);
print('loss_sec',loss_sec); 


print('finalImageCCAL',finalImageCCAL);

Map.addLayer(carbon_total_preterito,{palette:'800000'},'carbon_total_preterito');
Map.addLayer(carbon_total_anual.select(30),{palette:'00ffff'},'carbon_total_anual');
Map.addLayer(gain_loss.select(30),{palette:'ff00ff'},'gain_loss');
Map.addLayer(gain_loss.select(30).updateMask(gain_loss.select(30).neq(0)),{},'gain_loss not 0');
Map.addLayer(gain.select(30),{palette:'ffff00'},'gain');
Map.addLayer(loss.select(30),{palette:'0000ff'},'loss');
Map.addLayer(loss_pri.select(30),{palette:'00ff00'},'loss_pri');
Map.addLayer(loss_sec.select(30),{palette:'ff0000'},'loss_sec');
Map.addLayer(stable,{},'stable');

/// ----------------------------------------------------------------------------------------
/// Set your output and export dataset
/// ----------------------------------------------------------------------------------------

// Path your output
var version = 'QCN_MapBiomas';

var description = 'biomassa_balanco-QCN_MapBiomas8-1986_2022-v021';
var assetId = 'projects/mapbiomas-workspace/CCAL/';

Export.image.toAsset({
  image:finalImageCCAL,
  description:'W-SEEG_CCAL-'+description,
  assetId:assetId + description,
  pyramidingPolicy:'median',
  // dimensions:,
  region:biomas.geometry().bounds(),
  scale:30,
  // crs:,
  // crsTransform:,
  maxPixels:1e13,
  // shardSize:
});

Map.centerObject(incr_floresta_campestre,15);
