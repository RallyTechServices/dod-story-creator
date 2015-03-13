Ext.define('Rally.technicalservices.data.Template',{
    templateArtifact: null,
    model: null, 
    constructor: function(config) {
        Ext.apply(this,config);
    },    
    copy: function(copyRequest){
        var deferred = Ext.create('Deft.Deferred');
        
        var record = Ext.create(this.model, this._getDataToCopy(copyRequest));
        record.save({
            callback: function(record, operation, success) {
                if (operation.wasSuccessful()){
                    copyRequest.artifactResult = record;
                    deferred.resolve(copyRequest);
                } else {
                    copyRequest.artifactResult = operation.error.errors[0];
                    deferred.resolve(copyRequest);
                }
            }
        });
        return deferred;  
    },
    
    _getDataToCopy: function(copyRequest){
        var new_fields = {};
        Ext.each(copyRequest.copyFields, function(f){
            new_fields[f] = this.templateArtifact.get(f);
        }, this);
        
        if (!_.isEmpty(copyRequest.overrideFields)){
            Ext.Object.each(copyRequest.overrideFields, function(key,value){
                if (value){
                    new_fields[key] = value;
                }
            });
        }
        
        Ext.Object.each(copyRequest.transformers,function(field,fn){
            new_fields[field] = fn(this.templateArtifact);
        }, this);
        return new_fields;
    }
});
Ext.define('Rally.technicalservices.data.CopyRequest',{
    keyField: 'c_DoDStoryType',
    keyFieldValue: null, 
    overrideFields: null,
    referenceFields: null,
    transformers: null,
    identifier: null,
    copyFields: ['c_DoDStoryType','Project','Name','Description','Release'],
    constructor: function(config){
        Ext.apply(this,config);
    }
});