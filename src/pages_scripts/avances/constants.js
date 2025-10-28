export const AVANCE_PERMISSIONS = {
  CREATE: 'advances:create'
};

export const BIMESTRES_LIST = [
  {
    index: '1',
    label: 'Enero-Febrero',
    aliases: ['enero febrero', 'enero a febrero', 'enero y febrero', 'ene feb', 'bimestre 1', '1 bimestre', 'primer bimestre']
  },
  {
    index: '2',
    label: 'Marzo-Abril',
    aliases: ['marzo abril', 'marzo a abril', 'marzo y abril', 'mar abr', 'bimestre 2', '2 bimestre', 'segundo bimestre']
  },
  {
    index: '3',
    label: 'Mayo-Junio',
    aliases: ['mayo junio', 'mayo a junio', 'mayo y junio', 'may jun', 'bimestre 3', '3 bimestre', 'tercer bimestre']
  },
  {
    index: '4',
    label: 'Julio-Agosto',
    aliases: ['julio agosto', 'julio a agosto', 'julio y agosto', 'jul ago', 'bimestre 4', '4 bimestre', 'cuarto bimestre']
  },
  {
    index: '5',
    label: 'Septiembre-Octubre',
    aliases: ['septiembre octubre', 'septiembre a octubre', 'septiembre y octubre', 'sep oct', 'bimestre 5', '5 bimestre', 'quinto bimestre']
  },
  {
    index: '6',
    label: 'Noviembre-Diciembre',
    aliases: ['noviembre diciembre', 'noviembre a diciembre', 'noviembre y diciembre', 'nov dic', 'bimestre 6', '6 bimestre', 'sexto bimestre']
  }
];

export const AVANCE_REQUIRED_FIELDS = ['actividad_id', 'bimestre_id', 'meta_programada_bimestre', 'fecha_reporte'];
