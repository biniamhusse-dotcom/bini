const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3010;

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'bahmni-medical-mcp', timestamp: new Date().toISOString() });
});

app.get('/api/drugs/search', async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: 'name parameter required' });
    const response = await axios.get('https://api.fda.gov/drug/drugsfda.json', {
      params: { search: 'openfda.brand_name:"' + name + '" OR openfda.generic_name:"' + name + '"', limit: 5 }
    });
    const drugs = (response.data.results || []).map(function(d) {
      return {
        brandName: (d.openfda && d.openfda.brand_name && d.openfda.brand_name[0]) || 'N/A',
        genericName: (d.openfda && d.openfda.generic_name && d.openfda.generic_name[0]) || 'N/A',
        manufacturer: (d.openfda && d.openfda.manufacturer_name && d.openfda.manufacturer_name[0]) || 'N/A',
        route: (d.openfda && d.openfda.route && d.openfda.route[0]) || 'N/A',
        substanceName: (d.openfda && d.openfda.substance_name) || [],
        dosageForms: (d.dosage_form && d.dosage_form[0]) || 'N/A'
      };
    });
    res.json({ query: name, count: drugs.length, drugs: drugs });
  } catch (error) {
    res.json({ query: req.query.name, count: 0, drugs: [], error: error.message });
  }
});

app.get('/api/drugs/interactions', async (req, res) => {
  try {
    const { drug } = req.query;
    if (!drug) return res.status(400).json({ error: 'drug parameter required' });
    const response = await axios.get('https://dailymed.nlm.nih.gov/dailymed/services/v2/drugnames.json', {
      params: { drug_name: drug }
    });
    res.json({ drug: drug, interactions: (response.data && response.data.data) || [] });
  } catch (error) {
    res.json({ drug: req.query.drug, interactions: [], error: error.message });
  }
});

app.get('/api/drugs/label', async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: 'name parameter required' });
    const response = await axios.get('https://api.fda.gov/drug/label.json', {
      params: { search: 'openfda.brand_name:"' + name + '" OR openfda.generic_name:"' + name + '"', limit: 1 }
    });
    if (response.data.results && response.data.results.length > 0) {
      const label = response.data.results[0];
      res.json({
        name: name,
        indications: (label.indications_and_usage && label.indications_and_usage[0]) || 'N/A',
        dosage: (label.dosage_and_administration && label.dosage_and_administration[0]) || 'N/A',
        warnings: (label.warnings && label.warnings[0]) || 'N/A',
        contraindications: (label.contraindications && label.contraindications[0]) || 'N/A',
        adverseReactions: (label.adverse_reactions && label.adverse_reactions[0]) || 'N/A',
        drugInteractions: (label.drug_interactions && label.drug_interactions[0]) || 'N/A'
      });
    } else {
      res.json({ name: name, error: 'No label information found' });
    }
  } catch (error) {
    res.json({ name: req.query.name, error: error.message });
  }
});

app.get('/api/pubmed/search', async (req, res) => {
  try {
    const { query } = req.query;
    const maxResults = req.query.max_results || 10;
    if (!query) return res.status(400).json({ error: 'query parameter required' });
    const searchResponse = await axios.get('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi', {
      params: { db: 'pubmed', term: query, retmax: maxResults, retmode: 'json' }
    });
    const ids = (searchResponse.data.esearchresult && searchResponse.data.esearchresult.idlist) || [];
    if (ids.length === 0) return res.json({ query: query, count: 0, articles: [] });
    const fetchResponse = await axios.get('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi', {
      params: { db: 'pubmed', id: ids.join(','), retmode: 'json' }
    });
    var articles = [];
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var article = fetchResponse.data.result && fetchResponse.data.result[id];
      if (article && article.title) {
        var authorNames = [];
        if (article.authors) {
          for (var j = 0; j < article.authors.length; j++) {
            authorNames.push(article.authors[j].name);
          }
        }
        articles.push({
          pmid: id,
          title: article.title || 'N/A',
          authors: authorNames.join(', ') || 'N/A',
          journal: article.fulljournalname || article.source || 'N/A',
          pubDate: article.pubdate || 'N/A',
          url: 'https://pubmed.ncbi.nlm.nih.gov/' + id + '/'
        });
      }
    }
    res.json({ query: query, count: articles.length, articles: articles });
  } catch (error) {
    res.json({ query: req.query.query, count: 0, articles: [], error: error.message });
  }
});

app.get('/api/who/health-stats', async (req, res) => {
  try {
    var country = req.query.country || 'ET';
    var response = await axios.get('https://ghoapi.azureedge.net/api', {
      params: { '$filter': "SpatialDim eq '" + country + "'", '$top': 50, '$orderby': 'TimeDim desc' }
    });
    var data = response.data.value || [];
    var indicators = [];
    for (var i = 0; i < data.length && i < 20; i++) {
      indicators.push({ indicator: data[i].TimeDim, value: data[i].NumericValue, year: data[i].TimeDim });
    }
    res.json({ country: country, count: indicators.length, data: indicators });
  } catch (error) {
    res.json({ country: req.query.country || 'ET', data: [], error: error.message });
  }
});

app.get('/api/guidelines/search', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ error: 'query parameter required' });
    var niceResponse = { data: { results: [] } };
    try {
      niceResponse = await axios.get('https://api.nice.org.uk/search', {
        params: { q: query, page: 1, pageSize: 5, types: 'guideline' }
      });
    } catch (e) { /* ignore */ }
    var results = (niceResponse.data && niceResponse.data.results) || [];
    var guidelines = [];
    for (var i = 0; i < results.length; i++) {
      guidelines.push({
        source: 'NICE',
        title: results[i].title || 'N/A',
        url: results[i].url || 'N/A',
        summary: results[i].slug || 'N/A'
      });
    }
    res.json({ query: query, count: guidelines.length, guidelines: guidelines });
  } catch (error) {
    res.json({ query: req.query.query, count: 0, guidelines: [], error: error.message });
  }
});

app.get('/api/rxnorm/normalize', async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: 'name parameter required' });
    var response = await axios.get('https://rxnav.nlm.nih.gov/REST/rxnorm.json', {
      params: { term: name }
    });
    var idGroup = response.data.idGroup || {};
    res.json({
      name: name,
      rxcui: (idGroup.rxnormId && idGroup.rxnormId[0]) || null,
      allIds: idGroup.rxnormId || []
    });
  } catch (error) {
    res.json({ name: req.query.name, rxcui: null, allIds: [], error: error.message });
  }
});

app.listen(PORT, function() {
  console.log('Bahmni Medical MCP running on port ' + PORT);
});
