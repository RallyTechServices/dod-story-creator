Ext.override(Ext.grid.column.Check,{
    // Note: class names are not placed on the prototype bc renderer scope
    // is not in the header.
    renderer : function(value, meta, record) {
        console.log('renderer',value,meta,this.disabled);
        if (typeof value == 'object'){
          var link_text= Ext.String.format('{0}', value.FormattedID); 
          this.disabled = true; 
          return Rally.nav.DetailLink.getLink({record: '/hierarchicalrequirement/'+ value.ObjectID, text: link_text});
        }
        
        if (value === 'Exemption Approved'){
            meta.tdCls = '';
            this.disabled = true;  
            return value; 
        }

        if (value === true || value === 'Required'){
            //someone set this
            value = 'Required';
        } else {
            value = 'Exemption Requested';
        }
        var cssPrefix = Ext.baseCSSPrefix,
            cls = cssPrefix + 'grid-checkcolumn';

        if (this.disabled) {
            meta.tdCls += ' ' + this.disabledCls;
        }
        if (value === 'Required' || value === true) {
            cls += ' ' + cssPrefix + 'grid-checkcolumn-checked';
        }
        return '<img class="' + cls + '" src="' + Ext.BLANK_IMAGE_URL + '"/>';
    }
});
