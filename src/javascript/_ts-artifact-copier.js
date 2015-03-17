Ext.define('Rally.technicalservices.data.Template',{
    templateArtifact: null,
    templateTasks: null, 
    model: null,
    taskModel: null,
    constructor: function(config) {
        Ext.apply(this,config);
    },
    _loadTasks: function(templateTasks){
        var deferred = Ext.create('Deft.Deferred');

        if (templateTasks){
            deferred.resolve();
        }

        this.templateArtifact.getCollection('Tasks').load({
            scope: this,
            callback: function(tasks,operation,success){
                deferred.resolve(tasks);
            }
        });
        return deferred;
    },
    _loadModel: function(type){
        var deferred = Ext.create('Deft.Deferred');
        Rally.data.ModelFactory.getModel({
            type: type,
            scope: this,
            success: function(model) {
                deferred.resolve(model);
            }
        });
        return deferred;
    },
    _hasTasks: function(){
        return(this.templateArtifact.get('Tasks').Count > 0);
    },
    copy: function(copyRequest){
        var deferred = Ext.create('Deft.Deferred');
        if (this.templateArtifact){
            this._copyArtifact(this.model, this._getDataToCopy(copyRequest)).then({
                scope: this,
                success: function(result){
                    copyRequest.artifactResult = result;
                    if (typeof result == 'object' && this._hasTasks()){
                         if (this._hasTasks()){
                            var fieldsToCopy = copyRequest.copyCollections['Tasks'];
                            this._copyTasks(result, fieldsToCopy).then({
                                scope: this,
                                success: function(results){
                                    deferred.resolve(copyRequest);
                                }
                            });
                        }
                    } else {
                        deferred.resolve(copyRequest);
                    }
                }
            });
        }
        return deferred;
    },
    _copyTasks: function(newParent, fieldsToCopy){
        var deferred = Ext.create('Deft.Deferred');
        
        if (this.templateTasks == null){
            this._loadTasks(this.templateTasks).then({
                scope: this,
                success: function(templateTasks){
                    this.templateTasks = templateTasks;
                    this._loadModel('Task').then({
                        scope: this,
                        success: function(taskModel){
                            this._copyTemplateTasks(taskModel, newParent, fieldsToCopy).then({
                                scope: this,
                                success: function(results){
                                    deferred.resolve(results);
                                }
                            });
                        }
                    });
                }
            });
        } else {
            this._loadModel('Task').then({
                scope: this,
                success: function(taskModel){
                    this._copyTemplateTasks(taskModel, newParent, fieldsToCopy).then({
                        scope: this,
                        success: function(results){
                            deferred.resolve(results);
                        }
                    });
                }
            });
        }
         return deferred;
    },
    _copyTemplateTasks: function(taskModel, parent,fieldsToCopy){
        var deferred = Ext.create('Deft.Deferred');
        var promises = [];
        Ext.each(this.templateTasks, function(task){
            var fields = {};
            Ext.each(fieldsToCopy, function(f){
                fields[f] = task.get(f);
            });
            fields['WorkProduct'] = parent.get('_ref');
            var fn = this._copyArtifact;
            promises.push(function(){
                var deferred = Ext.create('Deft.Deferred');
                fn(taskModel,fields).then({
                    success: function(result){
                        deferred.resolve(result);
                    }
                });
                return deferred;
            });
        },this);

        Deft.Chain.sequence(promises,this).then({
            scope: this,
            success: function (results) {
                deferred.resolve(results);
            }
        });
        return deferred;

    },
    _copyArtifact: function(model, fields){
        var deferred = Ext.create('Deft.Deferred');

        var record = Ext.create(model, fields);
        record.save({
            callback: function(record, operation, success) {
                if (operation.wasSuccessful()){
                    deferred.resolve(record);
                } else {
                    deferred.resolve(operation.error.errors[0]);
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
    parentOid: null,
    keyField: 'c_DoDStoryType',
    keyFieldValue: null, 
    overrideFields: null,
    referenceFields: null,
    transformers: null,
    identifier: null,
    copyFields: ['c_DoDStoryType','Project','Name','Description','Release'],
    copyCollections: {"Tasks": ['Name','Description','Project']},
    constructor: function(config){
        Ext.apply(this,config);
    }
});