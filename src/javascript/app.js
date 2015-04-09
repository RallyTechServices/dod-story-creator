Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    items: [
        {xtype:'container',
            itemId:'header', 
            layout: {type:'hbox'}, 
            padding: 5},
        {xtype:'container',itemId:'display_box', padding: 5, layout: {type: 'fit'}},
        {xtype:'container',itemId:'footer', padding: 5, layout: {type: 'hbox'}}, 
        {xtype:'tsinfolink'}
    ],
    config: {
        releaseField: 'c_CodeDeploymentSchedule',
        releaseFieldLabel: 'Deployment Schedule',
        storyTypeField: 'c_DoDStoryType',
        portfolioItemFeature: 'PortfolioItem/Feature',
        dodStatusPrefix: 'c_DoDStatus',
        dodStatusDisplayPrefix: 'DoD Status: ',
        requiredValue: 'Required'
    },
    exportFieldMapping: {
        'FormattedID': 'FormattedID',
        'Name': 'Name'
    },
    dodFeatureFields: null,
    /**
     * featureArtifactHash:  a hash of arrays that hold the artifacts that contain dod stories for each feature
     * 
     */
    featureArtifactHash: null,
    featureRecords: null, 
    //UI configurations
    buttonWidth: 75, 
    buttonMargin: 10,
    noEntryText: '--',
    
    launch: function() {
        this._fetchDoDFields().then({
            scope: this,
            success: function(fields){
                this.dodFeatureFields = fields; 
                this._initialize();
            }
        });
    },
    _getFeatureGrid: function(){
        return this.down('#grid-feature');
    },
    _buildFeatureGrid: function(releaseValue){
        
        this._clearGrid(); 
        var fetch = _.union(['FormattedID','Name','_ref','Release'], _.keys(this.exportFieldMapping)); 
        
        this.down('#display_box').add({
            xtype: 'rallygrid',
            itemId: 'rally-grid',
            showRowActionsColumn: false,
            storeConfig: {
                model: this.portfolioItemFeature,
                fetch: fetch,
                autoLoad: true,
                filters: [{
                    property: this.releaseField,
                    value: releaseValue
                }],
                pageSize: 200
            },
          listeners: {
              beforeedit: function(editor, e){
                  var storyTypeValue = this._getStoryKey(e.field);
                  if (this._findStoryForFeature(e.record,this.featureArtifactHash,this.storyTypeField,storyTypeValue)){
                      e.cancel = true;
                      return false;
                  }
              },
              scope: this
            },
            columnCfgs: this._getColumnCfgs2()
        });
    },
    _fetchArtifactsWithStoryType: function(releaseValue){
        var deferred = Ext.create('Deft.Deferred');
        
        var storyTypeField = this.storyTypeField; 
        var releaseField = this.releaseField; 
        this.logger.log('_fetchArtifactsWithStoryType',releaseField,releaseValue,storyTypeField);
        Ext.create('Rally.data.wsapi.Store',{
            model: 'HierarchicalRequirement',
            autoLoad: true,
            context: {project: null},
            filters: [{
                property: storyTypeField,
                operator: '!=',
                value: ''
            },{
                property: releaseField,
                value: releaseValue || ''
            },{
                property: 'PortfolioItem',
                operator: '!=',
                value: null
            }],
            fetch: ['FormattedID',storyTypeField, releaseField, 'PortfolioItem','ObjectID','Name'],
            listeners: {
                scope: this,
                load: function(store, records, success){
                    this.logger.log('_fetchArtifactsWithStoryType', records.length, success);
                    if (success){
                        this.featureArtifactHash = this._buildFeatureArtifactHash(records);
                    } else {
                        this.featureArtifactHash = null; 
                        Rally.ui.notify.Notifier.showError('Could not load artifacts with release ' + releaseValue || 'null')
                        this.logger.log('_fetchArtifactsWithStoryType failure');
                    }
                    deferred.resolve();
                }
            }
        });
        
        return deferred; 
    },
    _buildFeatureArtifactHash: function(artifacts){
        var hash = {};
        Ext.each(artifacts, function(artifact){
            var pi = artifact.get('PortfolioItem');
            if (pi){
                
                hash[pi.ObjectID.toString()] = hash[pi.ObjectID] || [];
                hash[pi.ObjectID.toString()].push(artifact);                
            }
        });
        return hash;  
    },

    _getExportButton: function(){
        return this.down('#btn-export');
    },
    _getUpdateButton: function(){
        return this.down('#btn-update');
    },
    _getHeaderContainer: function(){
        return this.down('#header');
    },
    _getFooterContainer: function(){
        return this.down('#footer');
    },
    _getBodyContainer: function(){
        return this.down('#display_box');
    },
    _getReleaseCombo: function(){
        return this.down('#cb-release');
    },
    _initialize: function(){
        this._getHeaderContainer().add({
                xtype: 'rallyfieldvaluecombobox',
                model: 'UserStory',
                itemId: 'cb-release',
                field: this.releaseField,
                fieldLabel: this.releaseFieldLabel,
                labelWidth: 150,
                margin: 10,
                labelAlign: 'right',
                listeners: {
                    scope: this,
                    change: this._refreshDisplay 
                }
        });
        this._getHeaderContainer().add({
            xtype: 'component',
            flex: 1
        });
        this._getHeaderContainer().add({
                xtype: 'rallybutton',
                text: 'Export',
                itemId: 'btn-export',
                margin: 10,
                scope: this,
                width: this.buttonWidth,
                handler: this._export
        });
        
       
       this._getFooterContainer().add({
           xtype: 'component',
           flex: 1
       });
       this._getFooterContainer().add({
            xtype: 'rallybutton',
            text: 'Update',
            itemId: 'btn-update',
            width: this.buttonWidth,
            margin: 10,
            scope: this, 
            handler: this._update
        });
    },
    _refreshDisplay: function(cb){
        this.setLoading(true);
        var releaseValue = cb.getValue();  
        this._fetchArtifactsWithStoryType(releaseValue).then({
            scope: this,
            success: function(){
                this._buildFeatureGrid(releaseValue);
                this.setLoading(false);
            }
        });
    },
    _export: function(){
        var grid = this._getGrid();
        this.logger.log('_export',grid);

        var code_deployment = this._getReleaseCombo().getValue() || 'none';  
        var filename = Ext.String.format('dod-status-{0}.csv',code_deployment);

        var csv = Rally.technicalservices.FileUtilities.getCSVFromGrid(grid).then({
            scope: this,
            success: function(csv){
                if (csv && csv.length > 0){
                    Rally.technicalservices.FileUtilities.saveCSVToFile(csv,filename);
                } else {
                    Rally.ui.notify.Notifier.showWarning({message: 'No data to export'});
                }
                
            }
        });
    },  
    _update: function(){
        this.logger.log('_update');
        
        var grid = this._getGrid();
        if (grid == null){
            Rally.ui.notify.Notifier.showWarning({message: 'No records to update'});
            return;  
        }
        
        var artifactsToCreate = [];
        var dod_re = new RegExp(this.dodStatusPrefix);

        var store = grid.getStore(); 
        var promises = [];  
        var createTriggerValue = 'Required';
        var storyTypeField = this.storyTypeField; 
        var artifactFeatureHash = this.featureArtifactHash;
        
        var newArtifacts = [];
        var totalCount = store.totalCount;

        for (var i=0; i<store.getCount(); i++){
            var r = store.getAt(i);

            if (!_.isEmpty(r.getChanges())){
                promises.push(r.save());
            }
            
            var obj = r.getData();
            var keys = _.keys(obj);
            Ext.each(keys, function(key){
                if (dod_re.test(key)){
                    var storyTypeValue = this._getStoryKey(key);
                    var story = this._findStoryForFeature(r, artifactFeatureHash, storyTypeField, storyTypeValue);
                    if (story == null) {
                        if (obj[key] === createTriggerValue){
                            var newArtifact = {
                                feature: obj
                            };
                            newArtifact[storyTypeField] = key;
                            newArtifacts.push(newArtifact); 
                        }
                       
                    }

                }
            }, this);
        }

        if (promises.length > 0){
            Deft.Promise.all(promises).then({
                scope: this,
                success: function(results){
                    Ext.each(results, function(res){
                        if (typeof res == 'object'){
                            Rally.ui.notify.Notifier.showUpdate({artifact: res});
                        } else {
                            Rally.ui.notify.Notifier.showError({message: res});
                        }
                    });
                    this._createStories(newArtifacts);
                 }
            });
        } else {
            this._createStories(newArtifacts);
        }
    },
    _saveRecord: function(record){
       var deferred = Ext.create('Deft.Deferred');
       
        record.save({
           callback: function(result, operation) {
               if(operation.wasSuccessful()) {
                   deferred.resolve(result);
               } else {
                   deferred.resolve(operation.getError());
               }
           }
           });
        return deferred;  
    },
    _createStories: function(newArtifacts){
        //Create Stories 
        var releaseValue = this._getReleaseCombo().getValue();
        var store = this._getGrid().getStore();  
        var storyTypeField = this.storyTypeField; 
        var releaseField = this.releaseField; 
        
        var copyRequests = [];
        Ext.each(newArtifacts, function(a){
            var cr = this._buildCopyRequest(a,storyTypeField,releaseField, releaseValue);
            copyRequests.push(cr);
        },this);
        
        this.logger.log('_createStories', copyRequests);
        
        if (copyRequests.length > 0){
            var dlg_stories = Ext.create('Rally.technicalservices.dialog.TemplateCopier',{
                copyRequests: copyRequests,
                templateArtifactKeyField: storyTypeField,
                title: "Create Stories",
                listeners: {
                    scope: this,
                    artifactscreated: function(requests){
                        this.logger.log('artifacts Created',requests);
                        this._updateGrid(requests);
                    }
                }
            });
            dlg_stories.show();
        }
    },
    
    _buildCopyRequest: function(newArtifact,storyTypeField, releaseField, releaseValue){
        var cr = {};
        cr[storyTypeField] = this._getStoryKey(newArtifact[storyTypeField]);  
        cr['ObjectID'] = newArtifact.feature.ObjectID;
        cr['FormattedID'] = newArtifact.feature.FormattedID;
        cr['overrideFields'] ={};
        cr.overrideFields['PortfolioItem'] = newArtifact.feature._ref;
        cr.overrideFields[releaseField] = releaseValue;
        cr.overrideFields['Name'] = newArtifact.feature.FormattedID;
        //cr.overrideFields['Release'] = newArtifact.feature.Release;
        var featureOid = newArtifact.feature.ObjectID;
        var overrideFields = {"PortfolioItem": newArtifact.feature._ref};
        overrideFields[releaseField] = releaseValue;
        var identifier = this._getStoryKey(newArtifact[storyTypeField]) + ' for ' + newArtifact.feature.FormattedID;
        var cr = Ext.create('Rally.technicalservices.data.CopyRequest',{
            keyFieldValue: this._getStoryKey(newArtifact[storyTypeField]),
            overrideFields: overrideFields,
            parentOid: featureOid,
            identifier: identifier,
            transformers: {
                "Name": function(artifact){
                    return artifact.get('Name').replace("US Template",newArtifact.feature.FormattedID);
                }
            }
        });
        return cr;
    },
    
    _getStoryTypeFieldNameFromDisplayName: function(displayName){
        this.logger.log('_getStoryTypeFieldNameFromDisplayName',displayName);
        var fieldName = null; 
        Ext.Object.each(this.exportFieldMapping, function(key, val){
            if (val === displayName){
                fieldName = key;
                return false;
            }
        });
        return fieldName; 
    },
    _updateGrid: function(requests){
      this.logger.log('_updateGrid', requests);
      Ext.each(requests, function(r){
          if (typeof r.artifactResult == 'object'){
              var featureOid = r.parentOid;
              this.featureArtifactHash[featureOid] = this.featureArtifactHash[featureOid] || []; 
              this.featureArtifactHash[featureOid].push(r.artifactResult);
              Rally.ui.notify.Notifier.showCreate({artifact: r.artifactResult});
          } else {
              var msg = Ext.String.format('Unable to create artifact: {0}',r.identifier);
              Rally.ui.notify.Notifier.showError({message: msg});
          }
      }, this);
        this._getGrid().refresh(); 
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
    _getStoryTypeFromDisplayName: function(displayName){
        return displayName.replace(this.dodStatusDisplayPrefix,'',"i");
    },
    _fetchDoDFields: function(){
        var deferred = Ext.create('Deft.Deferred');
        var dod_fields = [];  
        Rally.data.ModelFactory.getModel({
            type: this.portfolioItemFeature,
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
    _createGrid: function(store){
        if (this._getGrid()){
            this._getGrid().destroy();
        } 

        var columns = this._getColumnCfgs();
        
        this._getBodyContainer().add({
            xtype: 'rallygrid',
            itemId: 'rally-grid',
            margin: 10,
            store: store, 
            scope: this,
            columnCfgs: columns,
            showRowActionsColumn: true,
            listeners: {
                beforeedit: function(editor, e){
                    if (typeof e.value == "object") {
                        e.cancel = true; 
                        return false; 
                    }
                }
            },
            plugins: [
                Ext.create('Ext.grid.plugin.CellEditing', {
                    clicksToEdit: 1
                })
            ],
        });
        
    },
    _getGrid: function(){
        return this.down('#rally-grid');
    },
    _clearGrid: function(){
        if (this._getGrid()){
            this._getGrid().destroy();            
        }
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
    _findStoryForFeature: function(feature, artifactFeatureHash, storyTypeField, storyTypeValue){
        var featureOid = feature.get('ObjectID');
        var artifacts = artifactFeatureHash[featureOid.toString()];
        var artifactFound = null;  
        if (artifacts == undefined){
            return artifactFound;
        }
        Ext.each(artifacts, function(artifact){
            if (artifact.get('c_DoDStoryType') === storyTypeValue){
               artifactFound = artifact; 
               return false;  
           } 
        });
        return artifactFound;
    },
    _getColumnCfgs2: function(){
        var noEntryText = this.noEntryText; 
        var dodFields = this.dodFeatureFields;
        var featureArtifactHash = this.featureArtifactHash;  
        var findStory = this._findStoryForFeature;
        var dodStatusDisplayPrefix = this.dodStatusDisplayPrefix; 
        var me = this;  
        
        var columns = 
            [{
                xtype: 'rallyrowactioncolumn',
                rowActionsFn: function(record){
                    return [{
                        text: 'Set Required', 
                        record: record,
                        scope: this,
                        handler: function(item){

                            Ext.each(dodFields, function(f){
                                var storyTypeValue = f.displayName.replace(dodStatusDisplayPrefix,'',"i")
                                var story = findStory(item.record, featureArtifactHash,f.name, storyTypeValue);
                                if (story == null){
                                    item.record.set(f.name, 'Required');                                    
                                }
                            }, this);
                        }
                    },{
                        text: 'Set Exemption Requested', 
                        record: record, 
                        scope: this,
                        handler: function(item){
                            Ext.each(dodFields, function(f){
                                var storyTypeValue = f.displayName.replace(dodStatusDisplayPrefix,'',"i")
                                var story = findStory(item.record, featureArtifactHash,f.name, storyTypeValue);
                                if (story == null){
                                    item.record.set(f.name, 'Exemption Requested');
                                }
                            }, this);
                        }
                    }];
               } 
            },{text:'Feature',
             dataIndex:'FormattedID',
             flex: 1,
             renderer: function(v,m,r){
                 var link_text= Ext.String.format('{0}: {1}', v, r.get('Name')); 
                 return Rally.nav.DetailLink.getLink({record: r.get('_ref'), text: link_text});
             },
             exportRenderer: function(v,m,r){
                 return Ext.String.format('{0}: {1}', v, r.get('Name')); 
             }
          }];
        
        Ext.each(this.dodFeatureFields, function(f){
            var col = {
                  //xtype: 'container',
                  text: this._getStoryTypeFromDisplayName(f.displayName),  //.replace(this.dodStatusDisplayPrefix,'',"i"),
                  dataIndex: f.name,
                  renderer: function(v,m,r){
                      var storyTypeValue = f.displayName.replace(dodStatusDisplayPrefix,'',"i");
                      var story = findStory(r, featureArtifactHash,f.name, storyTypeValue);
                      if (story){
                        var link_text= Ext.String.format('{0}', story.get('FormattedID')); 
                        return Rally.nav.DetailLink.getLink({record: '/hierarchicalrequirement/'+ story.get('ObjectID'), text: link_text});
                      }
                      return v || noEntryText;

                  },
                  exportRenderer: function(v,m,r){
                      var storyTypeValue = f.displayName.replace(dodStatusDisplayPrefix,'',"i");
                      var story = findStory(r, featureArtifactHash,f.name, storyTypeValue);
                      if (story){
                        return Ext.String.format('{0}', story.get('FormattedID')); 
                      }
                      return v || noEntryText;
                      
                  }
            };
            columns.push(col);
        },this);
        return columns;
    },
});