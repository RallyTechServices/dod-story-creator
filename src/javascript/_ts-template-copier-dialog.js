Ext.define('Rally.technicalservices.dialog.TemplateCopier', {
    extend: 'Rally.ui.dialog.Dialog',
    logger: new Rally.technicalservices.Logger(),
    autoShow: true,
    draggable: true,
    width: 300,
    modal: true,
    config: {
        title: 'Create Stories',
        copyRequests: null,
        templateArtifactKeyField: 'c_StoryType',
        templateModel: 'HierarchicalRequirement',
        templateFilters:[{
            property: 'PortfolioItem',
            value: 'portfolioitem/feature/24797386560'
        }] 
    },

    constructor: function(config) {
        Ext.apply(this,config);
        this.callParent(arguments);
    },
    
    initComponent: function() {
        this.callParent(arguments);
        this.addEvents('artifactscreated');
        this._buildPreview();  
        this._buildButtons();
    },    
    
    _buildPreview: function(){
        this.logger.log('_buildPreview', this.copyRequests);
        var header = Ext.String.format('{0} Total Stories to Create', this.copyRequests.length);
        var ct = this.add({
            xtype: 'rallygrid',
            layout: {
                align: 'center'
            },
            store: Ext.create('Rally.data.custom.Store', {
                data: this.copyRequests,
                pageSize: this.copyRequests.length,
                groupField: 'feature',
                groupDir: 'ASC',
                remoteSort: false,
                getGroupString: function(record) {
                    return ' Stories to create for ' + record.get('feature');
                }
            }),
            showPagingToolbar: false,
            features: [{
                ftype: 'groupingsummary',
                groupHeaderTpl: '{rows.length} {name}',
                startCollapsed: false
            }],
            columnCfgs: [{dataIndex: 'storyType', text: header, flex: 1}],
            maxHeight: 300,
            margin: 10
        });
        ct.update(this.copyRequests);
    },

    _create: function(){
         this._loadTemplatesIntoHash(this.copyRequests, this.templateArtifactKeyField).then({
            scope: this,
            success: this._doCopy
        });
    },
    
    _doCopy: function(templateHash){
        var promises = [];  
        Ext.each(this.copyRequests, function(req){
            var copier = templateHash[req.keyFieldValue];
            promises.push(function(){
                var deferred = Ext.create('Deft.Deferred');
                copier.copy(req).then({
                    scope: this,
                    success: function(req){
                        deferred.resolve(req);
                    }
                });
                return deferred;
            });
        });
        
        Deft.Chain.sequence(promises).then({
            scope: this,
            success: function(requests){
                this.fireEvent('artifactscreated',requests);
                this.destroy();
            }
        });
    },
    
    _getTemplateFetch: function(copyRequests){
        var fetch =[];
        Ext.each(copyRequests, function(req){
            fetch = Ext.Array.merge(fetch,req.copyFields);
            fetch = Ext.Array.merge(fetch,_.keys(req.copyCollections));
        });
        return fetch; 
    },
    
    _getTemplateFilters: function(copyRequests){
        var filters= this.templateFilters;
        return filters; 
    },
    
    _loadTemplatesIntoHash: function(copyRequests, hashKeyField){
        var deferred = Ext.create('Deft.Deferred');
        var fetch = this._getTemplateFetch(copyRequests);
        var filters = this._getTemplateFilters(copyRequests);
        this._fetchTemplates(this.templateModel, fetch, filters).then({
            scope: this,
            success: function(records){
                Rally.data.ModelFactory.getModel({
                    type: this.templateModel,
                    scope: this, 
                    success: function(model) {
                        templateHash = this._buildTemplateHash(records, model, hashKeyField);
                        this.logger.log('_loadTemplatesIntoHash (fetch,filters,hashKeyField,copyRequests,templateHash)',fetch, filters, hashKeyField,copyRequests,templateHash);
                        deferred.resolve(templateHash);
                        
                    }
                });
            }
      });
      return deferred; 
    },
    
    _buildTemplateHash: function(records, model, hashKeyField){
        var hash = {};
        Ext.each(records, function(r){
            hash[r.get(hashKeyField)] = Ext.create('Rally.technicalservices.data.Template',{
                templateArtifact: r,
                model: model
            });
        });
        return hash; 
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
                     deferred.resolve(records);
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
                text: 'Not Now',
                cls: 'secondary small',
                ui: 'link',
                scope: this,
                handler: this.destroy
            }]
        });
    }
});