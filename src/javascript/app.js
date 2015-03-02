Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    items: [
        {xtype:'container',itemId:'button_box', layout: {type:'hbox'}, padding: 5},
        {xtype:'container',itemId:'display_box', padding: 25},
        {xtype:'tsinfolink'}
    ],
    config: {
        releaseField: 'c_CodeDeploymentSchedule',
        releaseFieldLabel: 'Deployment Schedule',
        storyTypeField: 'c_DoDStoryType',
        portfolioItemL1: 'PortfolioItem/Feature',
        dodStatusPrefix: 'c_DoDStatus',
        dodStatusDisplayPrefix: 'DoD Status: ',
        requiredValue: 'Required'
    },
    exportFieldMapping: {
        'FormattedID': 'FormattedID',
        'Name': 'Name'
    },
    dodFeatureFields: null,
    featureRecords: null, 
    launch: function() {
        this._fetchDoDFields().then({
            scope: this,
            success: function(fields){
                this.dodFeatureFields = fields; 
                this._initialize();
            }
        });
    },
    _initialize: function(){
        this.down('#button_box').add({
            xtype: 'rallyfieldvaluecombobox',
            model: 'UserStory',
            itemId: 'cb-release',
            field: this.releaseField,
            fieldLabel: this.releaseFieldLabel,
            labelWidth: 175,
            margin: 10,
            labelAlign: 'right',
            listeners: {
                scope: this,
                change: this._buildGrid,
                //ready: this._buildGrid
                
            }
        });
        this.down('#button_box').add({
            xtype: 'rallybutton',
            text: 'Update',
            margin: 10,
            scope: this, 
            handler: this._update
        });
        this.down('#button_box').add({
            xtype: 'rallybutton',
            text: 'Export',
            margin: 10,
            scope: this,
            handler: this._export
        });
    },
    _export: function(){
        this.logger.log('_export');
        var grid = this.down('#rally-grid');
        if (this.exportData && this.exportData.length > 0){
            var code_deployment = this.down('#cb-release').getValue() || 'none';  
            var filename = Ext.String.format('dod-status-{0}.csv',code_deployment);
            var text = Rally.technicalservices.FileUtilities.convertDataArrayToCSVText(this.exportData, this.exportFieldMapping);
            Rally.technicalservices.FileUtilities.saveTextAsFile(text, filename);
        } else {
            Rally.ui.notify.Notifier.showWarning({message: 'No data to export'});
        }
    },  
    _update: function(){
        this.logger.log('_update');
        
        var grid = this.down('#rally-grid');
        if (grid == null){
            Rally.ui.notify.Notifier.showWarning({message: 'No records to update'});
            return;  
        }
        
        var store = grid.getStore(); 
        var updatedRecords = store.getUpdatedRecords();    
        this.logger.log('_update', store, updatedRecords);
        var features_to_update = [];
        var dod_re = new RegExp(this.dodStatusPrefix);
        //Ext.each(updatedRecords, function(r){
        for (var i=0; i<store.totalCount; i++){
            
            var r = store.getAt(i);
            var obj = r.getData();
            var raw_obj = r.raw;
            
            console.log('rec', r,obj,raw_obj);

            var keys = _.keys(obj);
            var stories_to_add = [];
            var update_feature = {
                    newStories: [], 
                    updatedFields: {}, 
                    _ref: obj._ref, 
                    FormattedID: obj.FormattedID, 
                    ObjectID: obj.ObjectID,
                    updateFlag: false};

            Ext.each(keys, function(key){
                if (dod_re.test(key)){
                    if (obj[key] === 'Required'){
                        update_feature.newStories.push(key); 
                    }
                    if (raw_obj[key] != obj[key]){
                        update_feature.updatedFields[key] = obj[key]; 
                    }
                }
            });
            if (update_feature.newStories.length > 0 || !_.isEmpty(update_feature.updatedFields)){
                features_to_update.push(update_feature);
            }
        }

        this.logger.log('_update',features_to_update);

        this._updateFeatures(features_to_update).then({
            scope: this,
            success: function(){
                this._createStories(features_to_update);                
            }
        
        });
    },
    _createStories: function(featuresToUpdate){
        //Create Stories 
        var code_deployment_val = this.down('#cb-release').getValue();
        var copy_requests = [];
        Ext.each(featuresToUpdate, function(f){
            if (f.newStories.length > 0){
                Ext.each(f.newStories, function(ns){
                    var cr = {};
                    cr[this.storyTypeField] = this._getStoryKey(ns);  
                    cr['FormattedID'] = f.FormattedID;
                    cr['overrideFields'] ={};
                    cr.overrideFields['PortfolioItem'] = f._ref;
                    cr.overrideFields[this.releaseField] = code_deployment_val;
                    cr.overrideFields['Name'] = f.FormattedID;
                    cr.overrideFields['Release'] = f.Release;
                    copy_requests.push(cr);
                },this);
            }
        },this);
        
        this.logger.log('_createStories', copy_requests);
        if (copy_requests.length > 0){
            var dlg_stories = Ext.create('Rally.technicalservices.dialog.TemplateCopier',{
                copyRequests: copy_requests,
                templateArtifactKeyField: this.storyTypeField,
                title: "Create Stories",
            });
            dlg_stories.show();
        }
    },
    _getStoryKey: function(fieldName){
        var displayName = fieldName;
        Ext.each(this.dodFeatureFields, function(field){
            if (field.name == fieldName){
                displayName = field.displayName;
                return false; 
            }
        });
        return this._getStoryTypeFromDisplayName(displayName); //.replace(this.dodStatusDisplayPrefix,''); 
    },
    _updateFeatures: function(featureObjs){
        var deferred = Ext.create('Deft.Deferred');
        Rally.data.ModelFactory.getModel({
            type: this.portfolioItemL1,
            scope: this,
            success: function(model) {
                this.logger.log('_updateFeatures model loaded');
                var promises = []; 
                Ext.each(featureObjs, function(obj){
                    if (!_.isEmpty(obj.updatedFields)){
                        promises.push(function(){this._updateFeature(model, obj)});
                    }
                }, this);
                
                if (promises.length == 0){
                    deferred.resolve();
                } else {
                    Deft.Chain.sequence(promises, this).then({
                        scope: this,
                        success: function(messages){
                            this.logger.log('_updateFeatures promises completed');
                            Rally.ui.notify.Notifier.show({message: messages.join("\n")});
                            deferred.resolve();
                        }
                    });
                }
            }
        });
        return deferred;  
    },
    _updateFeature: function(model, feature){
        var deferred = Ext.create('Deft.Deferred');
        var fetch = _.keys(feature.updatedFields);
        var formatted_id = feature.FormattedID;
        this.logger.log('_updateFeature', feature);
        model.load(feature.ObjectID, {
            fetch: fetch,
            scope: this,
            callback: function(result, operation) {
                this.logger.log('_updateFeature loaded', operation);
                if(operation.wasSuccessful()) {
                    this.logger.log('_updateFeature load success');
                    Ext.Object.each(feature.updatedFields, function(field,value){
                        this.logger.log('setting',feature.FormattedID, field,value);
                        result.set(field,value);
                    }, this);
                    result.save().then({
                        scope: this,
                        success: function(f){
                            var msg = formatted_id + " updated successfully";
                            this.logger.log('_updateFeature save success', msg);
                            deferred.resolve(msg);
                        }
                    });
                } else {
                    this.logger.log('_updateFeature unsuccessful');
                    var msg = Ext.String.format("{0} update failed [Error:  {1}]",formatted_id, operation.getError());
                    deferred.resolve(msg);
                }
            }
        });
        return deferred;  
    },
    _getStoryTypeFromDisplayName: function(displayName){
        return displayName.replace(this.dodStatusDisplayPrefix,'',"i");
    },
    _fetchDoDFields: function(){
        var deferred = Ext.create('Deft.Deferred');
        var dod_fields = [];  
        Rally.data.ModelFactory.getModel({
            type: this.portfolioItemL1,
            scope: this,
            success: function(model) {
                var fields = model.getFields();
                var re = new RegExp("^" + this.dodStatusPrefix ,"i");
                Ext.each(fields, function(f){
                    if (re.test(f.name)){
                        this.exportFieldMapping[f.name] = this._getStoryTypeFromDisplayName(f.displayName);
                        dod_fields.push(f);
                    }
                },this);
                deferred.resolve(dod_fields);
            }
        });
        
        return deferred;  
    },
    _renderDodColumn: function(v,m,r){
            var data;

            var editableValues = ['Required','Exemption Requested'];

            if (typeof v == "object") {
                var link_text= Ext.String.format('{0}: {1}', v.FormattedID, v.Name); 
                return Rally.nav.DetailLink.getLink({record: '/hierarchicalrequirement/'+ v.ObjectID, text: link_text});
            } else {
                if (Ext.Array.contains(editableValues, v) || v == null ){
                    // add a css selector to the td html class attribute we can use it after grid is ready to render the slider
                    m.tdCls = m.tdCls + 'editable-status';
                }
            } 
            return v; 
    },
    _getColumnCfgs: function(){
        var columns = 
            [{text:'Feature',
             dataIndex:'FormattedID',
             flex: 1,
             renderer: function(v,m,r){
                 var link_text= Ext.String.format('{0}: {1}', v, r.get('Name')); 
                 return Rally.nav.DetailLink.getLink({record: r.get('_ref'), text: link_text});
             }
          }];
        
        var uneditableStatus = ['Exemption Approved'];
        
        var editor_store = Ext.create('Ext.data.Store', {
            fields: ['name'],
            data : [
                {"name":"Required"},
                {"name": "Exemption Requested"}
                //...
            ]
        });
        
        Ext.each(this.dodFeatureFields, function(f){
            console.log(f.name);
            var col = {
                  //xtype: 'container',
                  text: this._getStoryTypeFromDisplayName(f.displayName),  //.replace(this.dodStatusDisplayPrefix,'',"i"),
                  dataIndex: f.name,
                  renderer: function(v,m,r){
                      if (typeof v == "object"){
                          var link_text= Ext.String.format('{0}', v.FormattedID); 
                          return Rally.nav.DetailLink.getLink({record: '/hierarchicalrequirement/'+ v.ObjectID, text: link_text});
                      }
                      if (Ext.Array.contains(uneditableStatus, v)){
                          m.tdCls = 'approved';
                      }
                      return v;
                  },
                  editor: {
                      xtype: 'combobox',
                      store: editor_store,
                      displayField: "name",
                      valueField: "name"
                  }

            };
            columns.push(col);
        },this);
        return columns;
    },
    _createGrid: function(store){
        if (this.down('#rally-grid')){
            this.down('#rally-grid').destroy();
        } 
        var uneditableValues = ['Exemption Approved'];
        var columns = this._getColumnCfgs();
        this.down('#display_box').add({
            xtype: 'rallygrid',
            itemId: 'rally-grid',
            store: store, 
            showRowActionsColumn: false,
            scope: this,
            columnCfgs: columns,
            selType: 'cellmodel',
            listeners: {
                beforeedit: function(editor, e){
                    if (typeof e.value == "object") {
                        e.cancel = true; 
                        return false; 
                    }
                    if (e.value === 'Exemption Approved'){
                        e.cancel = true; 
                        return false;
                    }
                }
            },
            plugins: [
                Ext.create('Ext.grid.plugin.CellEditing', {
                    clicksToEdit: 1,
                    listeners: {
                        beforeedit: function(grid, f, r, v){
                            console.log('beforeedit');
                            if (typeof v == "object") {
                                return false; 
                            }
                        }
                    }
                })
            ],
        });
        
    },

    _buildGrid: function(cb){
        if (cb.getValue() == null){
            return;
        }
        this._fetchFeatures(this.releaseField, cb.getValue()).then({
            scope: this,
            success: function(store){
                this._createGrid(store);
            }
        });
    },

    _fetchFeatures: function(releaseField, releaseValue){
        var deferred = Ext.create('Deft.Deferred');
        var dod_fields = [];
        Ext.each(this.dodFeatureFields, function(f){
            dod_fields.push(f.name)
        });
        var fetch_fields = _.union(['FormattedID','Name','_ref','Release'], dod_fields); 
        this.logger.log('_fetchFeatures',fetch_fields, releaseField,releaseValue);
        Ext.create('Rally.data.wsapi.Store',{
            fetch: fetch_fields,
            model: this.portfolioItemL1,
            autoLoad: true,
            filters: [{
                property: releaseField,
                value: releaseValue
            }],
            listeners: {
                scope: this,
                load: function(store, records, success){
                    this.logger.log('_fetchFeatures load', records.length, success);
                    var feature_oids = _.map(records, function(r){return r.get('ObjectID')});
                    this.featureRecords = records; 
                    this._fetchChildStories(feature_oids, releaseValue).then({
                        scope: this,
                        success: function(story_records){
                            this.logger.log('_fetchChildStories', feature_oids, story_records);
                            var store = this._buildCustomStore(records, story_records)
                            deferred.resolve(store);
                        }
                    });
                }
            }
        });
        return deferred;  
    },
    _fetchChildStories: function(feature_oids, releaseValue){
        var deferred = Ext.create('Deft.Deferred');
        
        var find = {
                "_TypeHierarchy": 'HierarchicalRequirement',
                "__At": "current"
            };
        find[this.storyTypeField] = {$ne: null};
        if (releaseValue){
            find[this.releaseField] = releaseValue;
        } else {
            find[this.releaseField] = null;
        }
      //  find[this.releaseField] = releaseValue;  
        this.logger.log('_fetchChildStories releaseValue',releaseValue, releaseValue == null);
        var chunker = Ext.create('Rally.technicalservices.data.Chunker',{
            fetch: ['FormattedID',this.storyTypeField, this.releaseField, 'PortfolioItem','ObjectID','Name'],
            find: find,
            chunkField: "PortfolioItem",
            chunkOids: feature_oids
        });
        chunker.load().then({
            scope: this,
            success: function(story_records){
                this.logger.log('_fetchChildStories', story_records.length, story_records);
                deferred.resolve(story_records);
            }
        });
        return deferred;
    },
    _buildCustomStore: function(features, stories){
        
        var feature_hash = {};
        Ext.each(stories, function(s){
            var pi = s.get('PortfolioItem');
            console.log(pi);
            feature_hash[pi] = feature_hash[pi] || [];
            feature_hash[pi].push(s.getData());
        });
        
       this.logger.log('_buildCustomStore feature_hash', feature_hash);
        var data = []; 
        
        Ext.each(features, function(f){
            var rec = {'FormattedID':f.get('FormattedID'),
                    'Name': f.get('Name'), 
                    '_ref': f.get('_ref'), 
                    'ObjectID': f.get('ObjectID'),
                    'Release': f.get('Release') || ''
            };
            Ext.each(this.dodFeatureFields, function(dod_f){
                var dod_type = this._getStoryTypeFromDisplayName(dod_f.displayName); //.replace(this.dodStatusDisplayPrefix,'');
                var story = null;  
                Ext.each(feature_hash[f.get('ObjectID')], function(s){
                    this.logger.log('_buildCustomStore associated stories',s[this.storyTypeField],dod_type,dod_f.displayName);
                    if (s[this.storyTypeField] == dod_type){
                        story = s;
                        return false;
                    }
                }, this);
   
                if (story){
                    rec[dod_f.name] = story;
                } else  {
                    rec[dod_f.name] = f.get(dod_f.name);
                } 
            },this);
            this.logger.log('feature data',rec);
            data.push(rec);
        }, this);
        this.exportData = data;  
        
        return Ext.create('Rally.data.custom.Store',{
            data: data
        });
    }
});