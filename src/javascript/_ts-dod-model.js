Ext.define('Rally.technicalservices.data.DoDModel',{
    extend: 'Ext.data.Model',
    fields: [
             {name: 'FeatureFormattedID', type: 'string'},
             {name: 'FeatureName', type:'string'}
             ],
    constructor: function(config){
        this.initConfig(config);
        console.log(this.fields);
        var fields = [];
        if (config.additionalFields){
            fields =  _.difference(this.fields, config.additionalFields);
        }
       // this.fields.push(config.additionalFields);
        console.log(fields );
    }
});