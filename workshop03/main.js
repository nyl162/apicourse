const { join } = require('path');
const fs = require('fs');

const cors = require('cors');
const range = require('express-range')
const compression = require('compression')

const { Validator, ValidationError } = require('express-json-validator-middleware')
const  OpenAPIValidator  = require('express-openapi-validator').OpenApiValidator;

const schemaValidator = new Validator({ allErrors: true, verbose: true });

const express = require('express')

const CitiesDB = require('./citiesdb');

//Load application keys
//Rename _keys.json file to keys.json
const keys = require('./keys.json')

console.info(`Using ${keys.mongo}`);

// TODO change your databaseName and collectioName 
// if they are not the defaults below
const db = CitiesDB({  
	connectionUrl: keys.mongo, 
	databaseName: 'zips', 
	collectionName: 'city'
});

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// TODO 1/2 Load schemans




// Start of workshop

// Mandatory workshop
// TODO GET /api/states
app.get('/api/states',(req,res)=>{
	res.type('application/json');
	db.findAllStates().then(result=>{
		res.set('X-Date',(new Date()).toISOString())
		res.status(200).json(result);
	}).catch(err=>{
		res.status(400).json({error:err});
	})
})

// TODO GET /api/state/:state
app.get('/api/state/:state',(req,res)=>{
	const state = req.params.state
	const limit = parseInt(req.query.limit) || 10;
	const offset = parseInt(req.query.offset) || 0;

	res.type('application/json');
	db.countCitiesInState(state).then(result=>{
		if(result <= 0 ){
			res.status(400).json({error: `Not a valid state: ${state}`});
		}
		return db.findCitiesByState(state, {offset: offset , limit: limit} )
	}).then(result=>{
		res.status(200).json(result.map(val=>`/api/city/${val}`));
	}).catch(err=>{
		res.status(400).json({error:err});
	})
})

// TODO GET /api/city/:cityId
app.get('/api/city/:cityId',(req,res)=>{
	const city_id = req.params.cityId
	//console.log(city_id)

	res.type('application/json');
	db.findCityById(city_id).then(result=>{
		if(result.length<=0)
			res.status(404).json({error: `City not found for Id: ${city_id}`})
		res.status(200).json(result[0]);
	}).catch(err=>{
		res.status(400).json({error:err});
	})
})

// TODO POST /api/city
app.post('/api/city',(req,res)=>{
	const cityParams = db.form2json(req.body)
	//console.log(req.body,cityParams)
	
	res.type('application/json');
	db.insertCity(cityParams).then(result=>{
		res.status(201).json(result)
	}).catch(err=>{
		res.status(400).json({error:err});
	})
	//res.status(200).json(cityParams);
})

// Optional workshop
// TODO HEAD /api/state/:state
app.head('/api/state/:state',(req,res)=>{
	//const state = req.params.state

	res.type('application/json').status(200).end();
	db.countCitiesInState(state).then(result=>{ // base on the Data, if a state with no city will not be a valid state. As the state is not a separate collection to city.
		if(result <= 0 ){
			res.status(400).json({error: `Not a valid state: ${state}`});
		}
		//return db.findCitiesByState(state, {offset:0 , limit:10} )
	})/*.then(result=>{
		res.status(200).json(result.map(val=>`/api/city/${val}`));
	})*/.catch(err=>{
		res.status(400).json({error:err});
	})
})

// TODO GET /state/:state/count
app.get('/state/:state/count',(req,res)=>{
	const state = req.params.state

	res.type('application/json');
	db.countCitiesInState(state).then(result=>{
		if(result <= 0 ){
			res.status(400).json({error: `Not a valid state: ${state}`});
		}
		res.status(200).json({result: `Number of cit${result>1?'ies':'y'} in ${state.toUpperCase()} is ${result}`});
	}).catch(err=>{
		res.status(400).json({error:err});
	})
})

// TODO GET /city/:name
app.get('/city/:name',(req,res)=>{
	const name = req.params.name

	res.type('application/json');
	db.findCitiesByName(name).then(result=>{
		//console.log(result,result.length,result.length <= 0)
		if(result.length <= 0 ){
			//console.log('not found')
			res.status(404).json({error: `City name not found for : ${name}`});
		}
		res.status(200).json(result);
	}).catch(err=>{
		res.status(400).json({error:err});
	})
})


// End of workshop

app.use('/schema', express.static(join(__dirname, 'schema')));

app.use((error, req, resp, next) => {
	if (error instanceof ValidationError)
		return resp.status(400).type('application/json').json({ error: error });
	else if (error.status)
		return resp.status(400).type('application/json').json({ error: error });
	next();
});

db.getDB()
	.then((db) => {
		const PORT = parseInt(process.argv[2] || process.env.APP_PORT) || 3000;

		console.info('Connected to MongoDB. Starting application');
		app.listen(PORT, () => {
			console.info(`Application started on port ${PORT} at ${new Date()}`);
		});
	})
	.catch(error => {
		console.error('Cannot connect to mongo: ', error);
		process.exit(1);
	});
