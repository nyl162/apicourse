const { join } = require('path');
const fs = require('fs');
const uuid = require('uuid/v1')

const cacheControl = require('express-cache-controller')
const preconditions = require('express-preconditions')
const cors = require('cors');
const range = require('express-range')
const compression = require('compression')

const { Validator, ValidationError } = require('express-json-validator-middleware')
const  OpenAPIValidator  = require('express-openapi-validator').OpenApiValidator;

const schemaValidator = new Validator({ allErrors: true, verbose: true });

const consul = require('consul')({ promisify: true });

const express = require('express')

const CitiesDB = require('./citiesdb');

const serviceId = uuid().substring(0, 8);
//const serviceName = `zips-${serviceId}`
const serviceName = 'zips';

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

//Disable etag for this workshop
app.set('etag', false);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Start of workshop

// TODO 1/3 Load schemans




// TODO 2/3 Copy your routes from workshop03 here
// TODO 1/2 Load schemans
const citySchema = require('./schema/city-schema.json');
//console.info('citySchema--->',citySchema)
new OpenAPIValidator({apiSpecPath: join(__dirname,'schema','city-api.yaml')}).install(app)

// Start of workshop

// Mandatory workshop
// TODO GET /api/states
app.get('/api/states',
	cacheControl({ maxAge: 30, private:false}),
	(req,res)=>{

	console.info('>>>>>get list of states -->', new Date())

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
			res.status(404).json({error: `Not a valid state: ${state}`});
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
app.post('/api/city',schemaValidator.validate({ body: citySchema}),(req,res)=>{
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




// End of workshop

app.get('/health', (req, resp) => {
	console.info(`health check: ${new Date()}`)
	resp.status(200)
		.type('application/json')
		.json({ time: (new Date()).toGMTString() })
})

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
			console.info(`\tService id: ${serviceId}`);

			// TODO 3/3 Add service registration here

			consul.agent.service.register({
				id: serviceId,
				name:serviceName,
				port: PORT,
				check:{
					//http:`http://localhost:${PORT}/health`,
					//interval:'30s',
					'ttl':'30s',
					deregistercriticalserviceafter: '120s'
				}
			})
			.catch(err=>{
				console.error(err)
			})
			//Heartbeat
			setInterval(()=>{
				console.info(serviceId,'heartbeat', new Date())
					consul.agent.check.pass({
						id:`service:${serviceId}`
					})
					.catch(err=>{
						console.error(err)
					})
				},30000// time in ms
			)


		});
	})
	.catch(error => {
		console.error('Cannot connect to mongo: ', error);
		process.exit(1);
	});
