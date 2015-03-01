
Ext.define('Rally.technicalservices.dialog.TemplateCopier', {
    extend: 'Rally.ui.dialog.Dialog',
    logger: new Rally.technicalservices.Logger(),
    autoShow: true,
    draggable: true,
    width: 300,
    config: {
        title: 'Create Stories',
        /**
         * createRequests - an array of objects that contain the following keys:
         *      - Parent (Feature) FormattedID 
         *      - Parent (Feature) ObjectID
         *      - Story Type
         *      - Overridden fields (Code Deployment Type, Release, Modified Name) 
         */
        copyRequests: null,
// Update Name
// Set codeDeployment
// Set release to feature's release,
// Update PortfolioItem (parent)

        templateArtifactHash: null,  //{}
        templateArtifactKeyField: 'c_StoryType',
        templateModel: 'HierarchicalRequirement',
        templateCopyFields: ['c_DoDStoryType','Project','Name','Description','Release'],
        templateFilters: [{
            property: 'PortfolioItem',
            value: 'portfolioitem/feature/24797386560'
        }],
    },

    constructor: function(config) {
        Ext.apply(this,config);
        this.callParent(arguments);
        console.log(this.copyRequests);
    },
    initComponent: function() {
        
        this.callParent(arguments);
        
        this._buildPreview();  
        this._buildButtons();

    },    
    _buildPreview: function(){
        this.logger.log('_buildPreview', this.copyRequests);
        var ct = this.add({
            xtype: 'container',
            layout: {
                align: 'center'
            },
            tpl: '<b>Stories to Create:</b><br/><br/><tpl for=".">{c_DoDStoryType} for {FormattedID}<br/></tpl>'
        });
        ct.update(this.copyRequests);
    },

    _create: function(){
        this.logger.log('_create');
        
        this._fetchTemplates(this.templateModel, this.templateCopyFields, this.templateFilters).then({
            scope: this,
            success: this._copyTemplates
        });
        
        this.destroy();
    },
    _copyTemplates: function(totalTemplates){
        this.logger.log('_copyTemplates', totalTemplates, this.copyRequests, this.templateArtifactHash);
        if (totalTemplates == 0){
            //Alert the user that they might need permissions to the main project.
            return;
        }
        
        var model = this._createModel(this.templateModel).then({
            scope: this,
            success: function(model){
                this.logger.log('modelCreated')
                this.model = model;  

                
                var promises = []; 
                
                Ext.each(this.copyRequests, function(cr){
                    var story_type = cr[this.templateArtifactKeyField];

                    var artifact_to_copy = this.templateArtifactHash[story_type];
                    
                    this.logger.log('_copyTemplates', story_type, artifact_to_copy, this.templateArtifactHash, this.templateArtifactHash[story_type],'x');
                    if (artifact_to_copy){
                        var fields = this._getNewArtifactFields(artifact_to_copy, cr.overrideFields);
                        this.logger.log('_copyTemplates', fields, artifact_to_copy);
                        promises.push(function(){this._createArtifact(this.model,fields);});
                    } else {
                        //todo alert user that there is a problem
                    }
                },this);
                this.logger.log('promises', promises.length);
                if (promises.length > 0){
                    Deft.Chain.sequence(promises, this).then({
                        scope: this,
                        success: function(artifactCount){
                            this.logger.log('_copyTemplates Success', artifactCount);
                        }
                    });
                }
            }
        });   
    },

    _getNewArtifactFields: function(artifactToCopy, overrideFields) {
        this.logger.log('_getNewArtifactFields', artifactToCopy, overrideFields);
            
        var new_fields = {};
        Ext.each(this.templateCopyFields, function(f){
            new_fields[f] = artifactToCopy.get(f);
        });
        
        if (overrideFields){
            Ext.Object.each(overrideFields, function(key,value){
                if (value){
                    new_fields[key] = value;                      
                }
            });            
        }
        
        new_fields['Name'] = artifactToCopy.get('Name').replace('US Template',new_fields['Name']);
        return new_fields;  
      },
      
     _createModel: function(modelType){
         var deferred = Ext.create('Deft.Deferred');
         Rally.data.ModelFactory.getModel({
             type: modelType,
             success: function(model) {
                deferred.resolve(model);
             }
         });
         return deferred; 
     },
     _createArtifact: function(model, fields) {
         var deferred = Ext.create('Deft.Deferred');

         var record = Ext.create(model, fields);
         record.save({
             callback: function(newArtifact, operation){
                 if (operation.wasSuccessful()) {
                     this.logger.log('_createArtifact successful', fields, operation);
                     deferred.resolve(newArtifact);
                 } else {
                     this.logger.log('_createArtifact failed', operation);
                     deferred.resolve({});
                 }
             },
             scope: this
         });
         return deferred;
     },
     _fetchTemplates: function(model, fetch, filters){
         var deferred = Ext.create('Deft.Deferred');
         this.logger.log('_fetchTemplates',model,fetch,filters);
         Ext.create('Rally.data.wsapi.Store',{
             model: model,
             fetch: fetch,
             filters: filters, 
             autoLoad: true,
             context: {project: null},
             limit: 'Infinity',
             listeners: {
                 scope: this,
                 load: function(store, records, success){
                     this.logger.log('_fetchTemplates load success', records.length, records);
                     this.templateArtifactHash = {};
                     Ext.each(records, function(r){
                         var key = r.get(this.templateArtifactKeyField);
                         this.templateArtifactHash[key] = r;
                     }, this);
                     deferred.resolve(records.length);
                 }
             }
         });
         return deferred; 
     },

    _buildButtons: function(){
        this.addDocked({
            xtype: 'toolbar',
            dock: 'bottom',
            padding: '8px 0 0',
            layout: {
                type: 'hbox',
                pack: 'center'
            },
            ui: 'footer',
            items: [{
                xtype: 'rallybutton',
                itemId: 'btnCreate',
                text: 'Create',
                cls: 'primary small',
                scope: this,
                handler: this._create
            },{
                xtype: 'rallybutton',
                itemId: 'cancelButton',
                text: 'Cancel',
                cls: 'secondary small',
                ui: 'link',
                scope: this,
                handler: this.destroy
            }]
        });
    }
});